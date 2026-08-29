# Deploying the ai-outfitter fleet

`clusters.yaml` names three agents on the `nonprod` cluster: `luce`, `vega`,
`outfitter-bot`. `.github/workflows/deploy.yml` assumes a dedicated IAM role
through GitHub OIDC and runs the `deploy-catalog` action once, deploying
exactly that set. CI only **moves objects that already exist**; this document
is what an administrator does once, by hand, before the first deploy of a new
agent.

## Dependency: agent-operator PR #46 must merge

`clusters.yaml`'s `organization: outfitter` key and the `__ORG__` token in
every `deployment.yaml` depend on a `deploy-catalog` feature that has not
merged as of 2026-08-19: `organization` is a short deployment prefix, not
necessarily the GitHub org login, and this catalog deliberately chose
`outfitter` rather than `ai-outfitter` — shorter, and it also avoids the
`ai-outfitter-outfitter-bot` stutter (rendering `outfitter-outfitter-bot`
instead). The pin in `deploy.yml` (`ea7e0706297d4884a457df0cc6236011a349f021`)
is the squash-merge of `ai-outfitter/agent-operator#46` on `main`
(merged 2026-08-20). It includes `__ORG__` rendering and documents
`organization: outfitter` as this catalog's own example.

## 1. IAM role for the deploy identity

Create `ai-outfitter-catalog-deploy` in account `216577824627` (the account the
shared nonprod cluster lives in), trusted only by this repository on `main`.

Trust policy condition:

```json
{
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": "repo:ai-outfitter/.agents:ref:refs/heads/main"
  }
}
```

The role needs only `eks:DescribeCluster` on the `nonprod` cluster; Kubernetes
authorization comes from the access entry below, not from IAM.

## 2. Map the role to a Kubernetes identity

Check whether the cluster's authentication mode is `CONFIG_MAP`, `API`, or
`API_AND_CONFIG_MAP` before choosing a mechanism (`aws eks describe-cluster
--name nonprod --query cluster.accessConfig`). For an EKS access entry:

```sh
aws eks create-access-entry \
  --cluster-name nonprod \
  --region us-east-1 \
  --principal-arn arn:aws:iam::216577824627:role/ai-outfitter-catalog-deploy \
  --type STANDARD \
  --username ai-outfitter-catalog-deploy \
  --kubernetes-groups ai-outfitter-catalog-deploy
```

For an `aws-auth` ConfigMap cluster, add the equivalent `mapRoles` entry
instead — see the account's own cluster documentation for the exact
mechanism, since it is shared with other tenants of this cluster.

## 3. Cluster authorization

```sh
kubectl apply -f deploy/rbac.yaml
```

## 4. Per-deployment secrets: two GitHub tokens each, for luce and vega

Luce and Vega are **shared-persona accounts** (`luce-unsup`, `vega-unsup`) —
the same GitHub machine accounts other organizations' deployments of these
personas also use. What is per organization is the **credential pair**, not
the account: mint this deployment's own tokens, never reuse another
deployment's.

| Variable | Kind | Scope |
| --- | --- | --- |
| `GITHUB_NOTIFY_TOKEN` | **classic** PAT | `notifications`, and nothing else |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | fine-grained PAT | resource owner **`ai-outfitter`** only, limited to the repositories the agent works |
| `GITHUB_USER` | — | the machine account's login |
| `GITHUB_NOTIFY_ORGS` | — | `ai-outfitter` |

`outfitter-bot` holds a dedicated ai-outfitter-only machine account, not a
shared persona, so it needs only the first three keys — there is no other
organization's wake to filter out.

**Why they stay two tokens.** `GET /notifications` accepts classic tokens
only — a fine-grained PAT and an App installation token are both rejected
with `403`. Collapsing to one classic token with `repo` would grant write
access to code, collaborators, and webhooks on every repository the shared
account can reach, in every organization it belongs to — classic scopes have
no organization selector.

**Why `GITHUB_NOTIFY_ORGS` exists.** The wake token has no organization
boundary: it sees notifications for every organization the shared account
belongs to, so both a `luce-unsup` deployment here and one deployed for
another organization wake on the same notification stream (a Channels
feature in flight). `GITHUB_NOTIFY_ORGS=ai-outfitter` is what lets this
deployment recognize a wake naming another organization's repository and
settle it without acting, instead of relying on the profile alone to
self-filter. Set it on every deployment of a shared-persona account; skip it
for a dedicated account like `outfitter-bot`, which has nothing to filter.

This catalog's convention is **one `agent-credentials` Secret per agent
namespace, everything projected `as: env`** — no side ConfigMap. Set
`GITHUB_NOTIFY_ORGS` as a fourth key in that same Secret rather than opening a
second config surface:

```sh
kubectl create namespace agent-outfitter-luce

kubectl -n agent-outfitter-luce create secret generic agent-credentials \
  --from-literal=GITHUB_NOTIFY_TOKEN='ghp_replace_with_the_classic_notifications_token' \
  --from-literal=GITHUB_PERSONAL_ACCESS_TOKEN='github_pat_replace_with_the_fine_grained_token' \
  --from-literal=GITHUB_USER='luce-unsup' \
  --from-literal=GITHUB_NOTIFY_ORGS='ai-outfitter'
```

Repeat for `agent-outfitter-vega` with `vega-unsup`, and for
`agent-outfitter-outfitter-bot` with its dedicated account and no
`GITHUB_NOTIFY_ORGS` key.

Prefix the command with a space (with `HISTCONTROL=ignorespace` set), or
`unset HISTFILE` first, so tokens do not land in shell history. Verify the
keys landed without printing any value:

```sh
kubectl -n agent-outfitter-luce get secret agent-credentials -o jsonpath='{.data}' | jq -r 'keys[]'
```

Confirm each account is assignable before relying on `assigned_issue` wakes:

```sh
# 204 = assignable; 404 = not a collaborator on that repository.
gh api -i "/repos/ai-outfitter/<repo>/assignees/<login>" 2>/dev/null | head -1
```

Protect `main` on every repository Luce or Vega works, the same way as any
other deployment of these personas — see the community-profiles catalog's
own Luce documentation for the exact ruleset; the boundary is enforced by the
forge, not by the token or the profile.

## App-backed resident credentials

The App-backed `resident` is provisioned per organization; it is not part of
the notification-driven `clusters.yaml` fleet above.
`agents/resident/deployment.yaml` records its reference declaration, while
the provisioner creates the organization-specific object and the operator
supplies these runtime values:

| Variable | Contract |
| --- | --- |
| `A2A_CREDENTIALS_PATH` | Path to JSON `{"credentials":[{"token":"<bearer>","principal":"forge-app"}]}` |
| `FORGE_TOKEN_URL` | Plain in-cluster HTTP endpoint, normally `http://<forge-app-service>.<org-namespace>.svc/internal/tokens` |

The bearer at `A2A_CREDENTIALS_PATH` authenticates the resident to that
organization's forge-app broker. The resident selects the credential whose
`principal` is `forge-app`; array order has no meaning. The file is mounted
read-only and must not be copied into the workspace.

M1 runs one resident per organization with both identities available to that
process. The identity split is therefore an advisory, prompt-level boundary,
not credential isolation: branch protection and any required human approval
remain the enforcing controls. A review of this resident's implementer PR is
valid only in a fresh conversation and fresh checkout, through the reviewer
identity, with an adversarial verdict derived again from the issue and full
diff. MCP identities are installation-scoped by construction because their
servers start before the task repository is known. Per-task MCP restart (or a
repository-scoped broker token after the task is known) and a dedicated
reviewer resident are later milestones.

The broker accepts `POST $FORGE_TOKEN_URL` with `Authorization: Bearer
<forge-app token>` and `Content-Type: application/json`. Both roles accept an
installation-scoped body:

```json
{"role":"implementer"}
```

```json
{"role":"reviewer"}
```

It returns `200` and `{"token":"<one-hour GitHub installation token>"}`.
The implementer role uses the organization's primary App; reviewer uses its
separate reviewer App. Either body may also include `repository`:

```json
{"role":"implementer","repository":"owner/repo"}
```

The broker validates the repository owner and restricts the resulting token
to that repository. Without `repository`, the token has its role's permissions
across the whole organization installation; for implementer this is an
installation-wide write credential. The MCP servers accept that blast radius
because they start once per session before any task repository is known. The
git askpass helper runs only once the trusted A2A task has named a repository,
so every fetch and push MUST set `FORGE_REPOSITORY=owner/repo` inline and the
helper MUST request the repository-scoped form.

`scripts/forge-mcp-launch.js` obtains the role-selected token and starts
`github-mcp-server`; `scripts/forge-git-askpass.js` supplies a repository-scoped
implementer or reviewer token only to git's credential prompt. The MCP
call driver, `scripts/forge-mcp-call.js`, performs the handshake and a JSON
request list in one bash-spawned server process when the runtime does not
project materialized MCP servers. The MCP
definitions resolve the catalog checkout from the `ai-outfitter/.agents`
source in `/workspace/.agents/settings.yml`, regardless of YAML key order or
quoting, then compute
`/workspace/.agents-cache/repos/<base64url(uri#revision)>`. This is the exact
rule in Outfitter's `code/cli/src/sources/SourceCache.ts`
(`encodeRemoteSource` / `createRemoteRepositoryCachePath`) and the operator's
`code/operator/internal/provisioner/server.go`
(`catalogBootstrapStep` / `catalogCacheKey`); Outfitter does not rewrite MCP
arguments or provide a catalog-root cwd. At startup each MCP launcher
atomically installs the askpass helper at `$HOME/.forge/forge-git-askpass.js`
and writes the informational catalog handoff to `$HOME/.forge/catalog-path`;
both use owner-only modes and never `/tmp`. The profile executes only the fixed
askpass path and does not derive it from the handoff. Keep the helper scripts
in the catalog checkout and preserve executable mode (`100755`) for scripts
invoked directly, especially `forge-git-askpass.js` and
`run-repository-checks.js`.

Repository-provided checks run through `scripts/run-repository-checks.js`,
which constructs a minimal environment containing only `PATH` and `HOME`.
This removes `A2A_CREDENTIALS_PATH`, `FORGE_TOKEN_URL`, `GIT_ASKPASS`, and all
`GITHUB_*` variables from test and build processes. This is only a partial
mitigation: the credential mount path remains fixed and guessable, and
same-UID processes can inspect MCP token environments through `/proc`. They can
also modify workspace paths reachable by checks, including
`$HOME/.forge/catalog-path`, the copied askpass helper, the catalog checkout,
and `/workspace/.agents/settings.yml`; treat all of those as untrusted after
repository code runs. Durable containment requires checks in a separate pod
with an enforcing network policy, or mounting credentials only into helper
processes rather than the agent container.

## 5. Namespace, Secret, and image-pull setup — the rest of the checklist

For each agent (`outfitter-luce`, `outfitter-vega`,
`outfitter-outfitter-bot`):

1. Create the namespace `agent-<agent-name>` (the operator also creates it on
   first apply via the Agent's owner reference, but creating it first lets
   the Secret exist before the first deploy).
2. Create `secret/agent-credentials` with the keys in the table above.
3. Create `secret/ghcr-pull` and patch the `agent-runtime` ServiceAccount with
   it, if the pinned runtime image is private:

   ```sh
   kubectl -n agent-<agent-name> patch serviceaccount agent-runtime \
     -p '{"imagePullSecrets":[{"name":"ghcr-pull"}]}'
   ```

4. Seed Pi model authentication into the stopped workspace PVC (see this
   cluster's existing model-auth seeding procedure); `Ready` does not prove a
   model turn works.
5. Apply this catalog once (`workflow_dispatch`, or push to `main`), wait for
   `Ready` with the expected resolved revision, then verify: an assigned
   test issue wakes the agent within one poll interval, and it either
   answers (Luce, outfitter-bot) or posts a `COMMENT`/`REQUEST_CHANGES`
   review (Vega) — never a push to `main`, never an `APPROVE`.

## Migration: cutover from Unsupervisedcom/.agents

The live CRs `luce-ai-outfitter` and `outfitter-bot` were deployed by
`Unsupervisedcom/.agents`'s catalog CI until this change — they are guests on
the shared nonprod cluster, documented in that repository's
`deploy/README.md` § "ai-outfitter org". This catalog's own CI now owns the
ai-outfitter agents.

Cutover, in order:

1. Complete steps 1–5 above so the new-name Agents (`outfitter-luce`,
   `outfitter-vega`, `outfitter-outfitter-bot`) exist and are `Ready`,
   running side by side with the old CRs.
2. Move or recreate secrets in the new namespaces rather than reusing the
   old ones directly:
   - `luce-ai-outfitter`'s `agent-credentials` (Luce's two GitHub tokens,
     `GITHUB_USER=luce-unsup`) → `agent-outfitter-luce`'s
     `agent-credentials`, plus the new `GITHUB_NOTIFY_ORGS` key.
   - `outfitter-bot`'s `outfitter-bot-forge-auth` (`GITHUB_USER`,
     `GITHUB_PERSONAL_ACCESS_TOKEN`) and `outfitter-bot-runtime`
     (`GIT_ASKPASS`, `GIT_TERMINAL_PROMPT`) ConfigMap →
     `agent-outfitter-outfitter-bot`'s single `agent-credentials` Secret.
     This catalog's `git-https-credential` setup step replaces the old
     `GIT_ASKPASS`/`GIT_TERMINAL_PROMPT` ConfigMap entirely — it derives the
     askpass helper from `GITHUB_USER` and
     `GITHUB_PERSONAL_ACCESS_TOKEN` directly, so neither ConfigMap key is
     needed in the new namespace.
   - Vega has no predecessor to migrate from; it is new in this change.
3. Verify the new Agents: resolved revision matches, logs name the expected
   account, and one real wake produces the expected write (a comment or PR
   for Luce/outfitter-bot, a `COMMENT`/`REQUEST_CHANGES` review for Vega).
4. Delete the old CRs **last**: `Agent/luce-ai-outfitter` and
   `Agent/outfitter-bot` in `Unsupervisedcom/.agents`'s `clusters.yaml`, then
   let that repository's next deploy remove them, or delete directly with an
   administrator kubeconfig. `Agent` is cluster-scoped and owns its
   namespace by owner reference — deleting it **cascades the old namespace**,
   including its Secrets and workspace PVC. Do this only after step 3 passes;
   there is no way back once it cascades.

## Failure modes worth recognising

- **`AssumeRoleWithWebIdentity` fails** — the OIDC subject changed. Renaming
  the workflow file, adding a job `environment:`, or deploying from a branch
  other than `main` mints an identity the trust policy does not accept.
- **`deploy: forbidden authorization was granted`** — RBAC drifted *wider*
  than intended. This is the check that catches a mistake nothing else would
  surface.
- **Agent never converges** — `Ready` is true but the resolved revision is
  not ours, meaning the pod is still serving the previous profile.
- **Deploy fails "manifest declares an Agent name that does not match"** —
  the pinned action SHA predates `__ORG__` rendering (see the Dependency
  section above); repin to a SHA that includes it.
- **Starts cleanly, never wakes** — token wrong or expired, filters exclude
  the reason, or the account is not assignable on that repository. None of
  these produces an error or a stack trace; treat token-expiry mail as an
  operational alert.
