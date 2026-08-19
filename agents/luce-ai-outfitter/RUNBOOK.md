# Luce — identity and credentials

How the Luce identity is set up: the mailbox behind it, the GitHub machine
account, and the two tokens each deployment needs. `deployment.yaml` references
this file; `README.md` covers the cluster-side bootstrap that consumes what you
create here.

## One operator, one account, many deployments

Luce is **one agent operator**: one mailbox, one GitHub machine account,
deployed once per organization. Do not create a second GitHub account for a
second organization — you would get two identities that cannot be told apart in
a thread, and twice the credentials to rotate.

What is per organization is the **credential**, not the account. Each
deployment holds its own pair of tokens, and a deployment's fine-grained token
names exactly one organization, so a deployment cannot write outside the
organization it was issued for. That boundary lives in the credential, not in
configuration an agent could change.

## The mailbox

The account is backed by a real mailbox on the organization's Google Workspace
(or equivalent), not a personal address and not an alias that forwards to a
human. It is needed for:

- GitHub sign-up and the verification mail;
- **2FA enrolment** — GitHub requires 2FA, and the recovery codes must be
  stored where the team can reach them, not in one person's password manager;
- password and token-expiry notices, which are the only warning you get before
  a deployment goes quiet.

Treat expiry notices as operational alerts. A token that lapses does not raise
an error anywhere in this stack — the agent stays `Ready` and simply stops
waking.

Keep the address itself out of this catalog: this repository is public. It
belongs in the private deployment runbook alongside the recovery codes.

## The GitHub machine account

A GitHub **App cannot be the assignee of an issue**, so this must be a machine
*user*. Wakes for `assigned_issue` arrive only if the forge can assign to it.

Invite the account to the organization and to the repositories it works, then
verify assignability before anything else — a non-assignable account produces a
deployment that starts cleanly and never wakes:

```sh
# 204 = assignable; 404 = not a collaborator on that repository.
gh api -i "/repos/ai-outfitter/<repo>/assignees/<login>" 2>/dev/null | head -1
```

## Two tokens, and why they must stay two

| Env key | Kind | Grants | Used by |
| --- | --- | --- | --- |
| `GITHUB_NOTIFY_TOKEN` | **classic** PAT | `notifications` — and nothing else | the Channels poller, to learn that work exists |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | **fine-grained** PAT | resource owner `ai-outfitter`; selected repositories; `Issues: read/write`, `Pull requests: read/write`, `Contents: read/write`, `Metadata: read` | `github-mcp-server` and the git push |

They cannot be collapsed into one.

**The poller must be classic.** `GET /notifications` supports personal access
tokens (classic) only; a fine-grained PAT and an App installation token are
both rejected with `403`. Verify before deploying:

```sh
# 200 = accepted; 403 = wrong token type.
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $GITHUB_NOTIFY_TOKEN" https://api.github.com/notifications

# Must print exactly `notifications`.
curl -sS -o /dev/null -w '%header{x-oauth-scopes}\n' \
  -H "Authorization: Bearer $GITHUB_NOTIFY_TOKEN" https://api.github.com/notifications
```

**The account needs write through a team — the token cannot grant what the
account does not hold.** A fine-grained PAT's effective access is the
*intersection* of the token's permissions and the account's own repository
role. An org member with no repository role can still read a public repository,
so everything looks fine until the first write: `push: false`, and a `403` on
the branch push with token permissions that look correct. The fix here was a
team: add the machine account to the org's **Agents** team and give that team
**write** on the repositories the agent works. Observed live on 2026-08-19 —
org-approving the token changed nothing until the team grant existed.

**The fine-grained token must be approved by the organization.** Minting it
is not the last step: when the organization's fine-grained-PAT policy requires
approval, the token sits pending in
`github.com/organizations/ai-outfitter/settings/personal-access-token-requests`
until an owner approves it — and *editing an approved token's permissions can
put it back into that queue*. An unapproved token does not error at mint time;
it simply acts with read-only access, so the deployment presents as an agent
that wakes, implements, and then gets `403` on the branch push and even on the
issue comment, reporting `push: false`. Observed live on 2026-08-19. If every
write 403s while reads work, check the approval queue before rotating anything.

**Repository work must not be classic.** The shortcut is to add `repo` to the
classic token and use one credential everywhere. `repo` grants write access to
code, collaborators, and webhooks on *every* repository the account can reach,
in *every* organization it belongs to — classic scopes have no repository or
organization selector. Since this one account is a member of more than one
organization, that single addition would hand every deployment write access to
all of them. The fine-grained token enumerates its repositories and permissions
explicitly, so anything unlisted is denied.

**Do not set `GITHUB_TOKEN`.** Channels reads `GITHUB_NOTIFY_TOKEN` and falls
back to `GITHUB_TOKEN`, and treats the mere presence of either as "the GitHub
channel is configured". A work token under that name yields a poller that
`401`s every interval and only logs it — the source never throws, so the agent
looks healthy and can never be woken. Name the work token
`GITHUB_PERSONAL_ACCESS_TOKEN`.

### Contents: write, and what actually restrains it

This deployment's Luce implements the issues assigned to her, so her
fine-grained token needs `Contents: read/write` to push a branch. Git does not
distinguish that from a push to `main`, and the token cannot express the
difference — **branch protection on the forge is what stops her**, not the
token and not anything in the pod. See `README.md` § "Branch protection".

A comment-only Luce should instead hold `Contents: read`; then the token itself
forbids every push and no protection is load-bearing for her.

### The token is the second control, not the only one

`mcp.json` pins an explicit tool allowlist rather than toolsets, because a
toolset exposes dozens of tools including `merge_pull_request`, `push_files`,
and `delete_file`, and nothing in the tool layer blocks them — only the token's
permissions do. Keep the allowlist and the token narrow together; either alone
is one mistake away from an unintended write.

Do not substitute `--read-only` for a narrow allowlist: it also removes
`add_issue_comment`, so Luce wakes and can never answer.

## The wake inbox is not org-scoped

A classic token has no organization boundary: it sees notifications for every
organization the shared account belongs to. The `github` channel source filters
on notification **reason** only (`GITHUB_NOTIFY_FILTERS`) — it has no
organization or repository filter.

Both deployments therefore wake on the same notification. This is safe rather
than merely tolerable: the fine-grained token cannot act outside its own
organization, so the worst outcome of a foreign wake is a wake that produces
nothing. Expect those in the logs; they are the design. The profile tells Luce
to settle such a task without acting or commenting.

## The `agent-credentials` convention

Every resident agent's environment comes from **one Secret named
`agent-credentials`, in the agent's own namespace**. The namespace is what
scopes it — `agent-<name>` is unique per agent — so the Secret's name never
varies, nothing is namespaced to one identity, and every manifest, runbook,
and rotation command in the fleet reads the same way.

Rules:

- One `agent-credentials` Secret per agent namespace, projected `as: env`.
  All credentials and any non-default environment go in it; there is no
  side ConfigMap.
- Keys are the standard names, never agent-prefixed: `GITHUB_NOTIFY_TOKEN`,
  `GITHUB_PERSONAL_ACCESS_TOKEN`, `GITHUB_USER`, `OPENAI_API_KEY`, and so on.
- Image-pull credentials are the one exception: `ghcr-pull` is consumed by the
  kubelet through the ServiceAccount, not by the process environment, so it
  stays its own Secret.
- Rotation is always: `kubectl patch secret agent-credentials` with the new
  values, then `kubectl rollout restart deployment/agent-runtime` — the
  environment is read at process start.

## How the operator delivers this

Verified against `ai-outfitter/agent-operator`, because the shape here depends
on three behaviours that are not obvious from the manifest:

- **`AgentSpec` has no `env` field.** Everything reaches the container through
  `spec.credentials`, and the controller projects an `as: env` entry into
  `EnvFrom` — `SecretRef` for a Secret, `ConfigMapRef` for a ConfigMap. Secret
  and non-secret values therefore arrive identically, which is why one Secret
  carries the whole environment and there is no ConfigMap.
- **Setup steps are init containers, and they receive the same `EnvFrom`.**
  That is what lets the `git-https-credential` step read `GITHUB_USER` and
  `GITHUB_PERSONAL_ACCESS_TOKEN`. Note the consequence: an environment variable
  *exported* inside a setup step does not survive into the agent container —
  only files do.
- **Both containers run with `HOME=/workspace`, the durable PVC.** So the
  askpass helper and the `.gitconfig` the setup step writes are still there
  when the agent container starts, and they survive a restart.

## Rotation

Tokens expire and the failure is silent. On rotation, replace the Secret and
then restart the agent's Deployment — the values are read into the process
environment at start, so a running pod keeps the old ones:

```sh
kubectl -n agent-luce-ai-outfitter create secret generic agent-credentials \
  --from-literal=GITHUB_NOTIFY_TOKEN='ghp_the_new_classic_token' \
  --from-literal=GITHUB_PERSONAL_ACCESS_TOKEN='github_pat_the_new_fine_grained_token' \
  --from-literal=GITHUB_USER='luce-machine-account' \
  --dry-run=client -o yaml | kubectl -n agent-luce-ai-outfitter apply -f -

kubectl -n agent-luce-ai-outfitter rollout restart deployment/agent-runtime
```

Revoke the old tokens *after* the restart completes, not before.
