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

### 1. Two tokens for the existing Luce account

> Identity, the mailbox, and the exact token permissions are documented in
> [RUNBOOK.md](RUNBOOK.md). This section covers only what the deploy needs.

Luce is **one agent operator** — a single GitHub machine account, backed by
one mailbox — deployed once per organization. Do not create a second account
for ai-outfitter. The account already exists and is already a
member of this organization; confirm it is assignable here before anything
else, because `assigned_issue` wakes arrive only if the forge can assign to it:

```sh
# 204 = assignable; 404 = not a collaborator on that repository.
gh api -i "/repos/ai-outfitter/<repo>/assignees/<login>" 2>/dev/null | head -1
```

A GitHub App cannot be the assignee of an issue, which is why this is a machine
user rather than an App.

What is **per organization is the credential, not the account**. Mint this
deployment's own pair; do not reuse another deployment's.

| Variable | Type | Scope |
| --- | --- | --- |
| `GITHUB_NOTIFY_TOKEN` | **classic** PAT | `notifications`, and nothing else |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | fine-grained PAT | resource owner **`ai-outfitter`**, only the repositories Luce works. Permissions: Contents **write** (to push her branch), Pull requests **write**, Issues **write**. Nothing else. |
| `LUCE_GITHUB_LOGIN` | — | the machine account's login, for the HTTPS push |

`GET /notifications` accepts classic tokens only: it rejects a fine-grained
token and an App installation token with `403`.

**The two tokens draw different boundaries, and only one of them is a boundary
at all.** The fine-grained work token has exactly one resource owner as a
property of the credential, so this deployment cannot write outside
`ai-outfitter` — that is what makes the deployment org-scoped. The classic wake
token has no organization boundary and cannot be given one: it sees
notifications for *every* organization the shared account belongs to.

The `github` channel source filters on notification **reason** only
(`GITHUB_NOTIFY_FILTERS`); it has no organization or repository filter. So both
deployments of Luce wake on the same notification, and each must recognise the
subjects that are not its own and settle them without acting. Expect wakes for
another organization's work in the logs; that is the design, not a
misconfiguration. The profile's Identity section carries the rule.

This also makes the wake token's narrow scope load-bearing in the other
direction: because it has no organization boundary, anyone adding `repo` "to be
safe" turns it into a cross-organization *write* credential shared by every
deployment. Keep it at `notifications` and nothing else.

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

### 2. Branch protection — the only thing that stops her pushing to `main`

Contents **write** is what lets Luce push her feature branch, and git does not
distinguish that from a push to `main`. The token cannot express the
difference, so the forge has to: protect `main` on every repository she works.

```sh
cat > ruleset.json <<'JSON'
{
  "name": "protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      } },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ]
}
JSON
gh api -X POST /repos/ai-outfitter/<repo>/rulesets --input ruleset.json
```

`required_approving_review_count` is `0` deliberately: the rule exists to stop
a *direct push*, not to require a second human on a one-maintainer repository.
Raise it when there is someone to review. Leave `bypass_actors` empty — a
bypass entry silently returns the ability this whole section removes.

Verify from her side rather than trusting the config — a protected branch
rejects the push at the server:

```sh
gh api /repos/ai-outfitter/<repo>/rules/branches/main --jq '[.[].type]'
```

`pull_request` in that list means a direct push is refused and a pull request
is the only way in.

Protection is **per repository**, so it has to hold on every repository Luce
works — a new one starts unprotected. Audit the whole organization before
widening what she is assigned:

```sh
gh repo list ai-outfitter --limit 100 --json name --jq '.[].name' | while read -r r; do
  printf '%s: %s\n' "$r" \
    "$(gh api "/repos/ai-outfitter/$r/rules/branches/main" --jq '[.[].type] | join(",")' 2>/dev/null)"
done
```

An empty result is an unprotected default branch. An organization-level
ruleset (`POST /orgs/ai-outfitter/rulesets` with
`conditions.repository_name.include: ["~ALL"]`) covers repositories created
later and is the better long-term shape; it needs organization-owner rights.

This has to be enforced on the server. A client-side control — a pre-push hook
in the agent's pod, a rule in her profile — is configuration the agent itself
can see and change, and `--no-verify` skips any hook. It is not a boundary, and
treating it as one produces a restriction that looks enforced and is not.

`governance/sdlc-baseline.yaml` records the intent for conformance reporting —
Luce `may: [open-issue, comment, assign, push-branch, open-pr, request-review]`
and `may-not: [merge, push-protected]` — so a report shows any repository that
drifts out of protection. The ruleset is what enforces it.

The organization scoping works the same way: a fine-grained PAT has exactly one
resource owner as a property of the credential, so a Luce carrying an
`ai-outfitter` token cannot reach another organization even if something in an
issue body asks her to.

### 3. Prove the wake on a workstation, before the first deploy

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

### 4. Namespace, Secret, and ConfigMap

```sh
kubectl create namespace agent-luce

kubectl -n agent-luce create secret generic luce-forge \
  --from-literal=GITHUB_NOTIFY_TOKEN="$GITHUB_NOTIFY_TOKEN" \
  --from-literal=GITHUB_PERSONAL_ACCESS_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN" \
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

### 5. Deploy-role `resourceNames`, and the `fleet` environment

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
| Push fails with no prompt | `LUCE_GITHUB_LOGIN` or `GITHUB_PERSONAL_ACCESS_TOKEN` missing, so `GIT_ASKPASS` returns empty |
| Branch push rejected by the server | Contents write missing from the fine-grained token, or the ruleset also blocks non-default branches |

None of these produces an error or a stack trace.
