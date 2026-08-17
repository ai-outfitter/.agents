# Deploying Luce

`deployment.yaml` beside this file puts Luce in the fleet: `deploy-catalog`
globs `agents/*/deployment.yaml`, so the tree is the deploy list. On merge to
`main`, `.github/workflows/deploy.yml` renders `__REVISION__` with the merge
commit, applies, and waits for the `Agent` to report that exact revision
resolved — not merely `Ready`, which passes while the old pod still serves the
previous profile.

CI only **moves objects that already exist**. Everything below is an
administrator's, and a first deploy fails the preflight with the exact missing
permission before anything is applied.

## What CI cannot do for you

### 1. A Luce machine account, with two tokens

A GitHub App **cannot be the assignee of an issue**, so this must be a machine
user with access to the repositories Luce works in. Wakes for `assigned_issue`
arrive only if the forge can assign to this account.

| Variable | Type | Scope |
| --- | --- | --- |
| `GITHUB_NOTIFY_TOKEN` | **classic** PAT | `notifications`, and nothing else |
| `GITHUB_TOKEN` | fine-grained PAT | resource owner `ai-outfitter`, only the repositories Luce works |
| `LUCE_GITHUB_LOGIN` | — | the machine account's login, for the HTTPS push |

`GET /notifications` accepts classic tokens only: it rejects a fine-grained
token and an App installation token with `403`. The narrow scope on the wake
token matters in the other direction too — a classic token has no organization
boundary, so anyone adding `repo` "to be safe" turns it into a
cross-organization write credential.

Verify without printing either token:

```sh
# 200 = accepted for notifications; 403 = wrong token type.
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $GITHUB_NOTIFY_TOKEN" \
  https://api.github.com/notifications

# Must print exactly `notifications`.
curl -sS -o /dev/null -w '%header{x-oauth-scopes}\n' \
  -H "Authorization: Bearer $GITHUB_NOTIFY_TOKEN" \
  https://api.github.com/notifications
```

### 2. Prove the wake on a workstation, before the first deploy

Do not skip this. Every misconfiguration in this channel fails **silently** —
the process starts cleanly, logs nothing, and never wakes — so a quiet pod is
indistinguishable from a source fault and a deployment fault. This step tells
them apart while only one of them can be at fault.

```sh
export GITHUB_NOTIFY_TOKEN="ghp_…"
export GITHUB_NOTIFY_FILTERS="assigned_issue"
export OUTFITTER_CHANNELS="github"
pi -e git:github.com/ai-outfitter/channels@03fb6d22769fb31f1d4f5241b109502f5ab9a848
```

Confirm the startup identity line names the machine account, not you. Then
assign a throwaway issue from a **second** account and expect, within one poll
interval:

```text
[channels:github] waking agent for: github
```

Then confirm the negative case: activity matching no filter produces no wake.

### 3. Namespace, Secret, and ConfigMap

```sh
kubectl create namespace agent-luce

kubectl -n agent-luce create secret generic luce-forge \
  --from-literal=GITHUB_NOTIFY_TOKEN="$GITHUB_NOTIFY_TOKEN" \
  --from-literal=GITHUB_TOKEN="$GITHUB_TOKEN" \
  --from-literal=LUCE_GITHUB_LOGIN="<machine-account-login>"

kubectl -n agent-luce create configmap luce-runtime \
  --from-literal=OUTFITTER_CHANNELS=github \
  --from-literal=GITHUB_NOTIFY_FILTERS=assigned_issue \
  --from-literal=GITHUB_NOTIFY_POLL_MS=15000 \
  --from-literal=GIT_TERMINAL_PROMPT=0 \
  --from-literal=GIT_AUTHOR_NAME=Luce \
  --from-literal=GIT_COMMITTER_NAME=Luce \
  --from-literal=GIT_AUTHOR_EMAIL='luce@users.noreply.github.com' \
  --from-literal=GIT_COMMITTER_EMAIL='luce@users.noreply.github.com'
```

`assigned_issue`, not `assign`: GitHub sends one `assign` reason for both
issues and pull requests, and the source splits it by subject type, so a filter
named `assign` matches nothing. `GITHUB_NOTIFY_POLL_MS` is a floor — the source
honors GitHub's `X-Poll-Interval` when GitHub asks for a longer gap.

### 4. Deploy-role `resourceNames`, and the `fleet` environment

The deploy identity needs `get` and `patch` on `agents.aioutfitter.com/luce`,
`organizations.aioutfitter.com/ai-outfitter`, and `deployments.apps/agent-runtime`
in `agent-luce`. It must **not** be able to `delete` them, to reach any agent
unscoped, or to read Secrets in `agent-luce`; the preflight asserts both
directions and fails closed.

The workflow's `fleet` environment supplies `AWS_DEPLOY_ROLE_ARN`,
`AWS_REGION`, and `EKS_CLUSTER_NAME`. This repository is public — the
environment is what keeps an unreviewed push away from the cluster role, and it
keeps every cluster-identifying value out of the workflow file.

## Verify the loop

Assign a real issue to the machine account. Expect a wake within a poll
interval, then a branch and a pull request referencing the issue.

| Symptom | Cause |
| --- | --- |
| No identity line at startup | `github` missing from `OUTFITTER_CHANNELS`, or no token in the environment |
| `identity check failed` | Token wrong or expired |
| Identity line shows a human login | The Secret carries the wrong account's token |
| Preflight returns 403 | The wake token is fine-grained or an App token, not classic |
| Starts cleanly, never wakes | Filters exclude the reason, or the account is not assignable on that repository |
| Wakes, then does nothing | The deployed profile still restricts tools to the channel tools — check the revision the `Agent` resolved, not the merged file |
| Push fails with no prompt | `LUCE_GITHUB_LOGIN` or `GITHUB_TOKEN` missing, so `GIT_ASKPASS` returns empty |

None of these produces an error or a stack trace.
