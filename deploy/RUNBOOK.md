# Deploying the ai-outfitter fleet

`clusters.yaml` names three agents on the `nonprod` cluster: `luce`, `vega`,
`outfitter-bot`. `.github/workflows/deploy.yml` assumes a dedicated IAM role
through GitHub OIDC and runs the `deploy-catalog` action once, deploying
exactly that set. CI only **moves objects that already exist**; this document
is what an administrator does once, by hand, before the first deploy of a new
agent.

## Dependency: use a released agent-operator checkout

The IAM role is defined by agent-operator's shared
`actions/deploy-catalog/aws/identity-stack.yaml` CloudFormation template.
Use the `agent-operator-v0.9.0` checkout when running the bootstrap commands
below. The catalog owns only the environment-specific parameters, the
`aws-auth` mapping, and Kubernetes RBAC.

## 1. Confirm the cluster supports `aws-auth`

This rollout deliberately uses the existing, tested `aws-auth` mechanism.
Check the cluster before changing anything:

```sh
authentication_mode="$(aws eks describe-cluster \
  --name nonprod \
  --region us-east-1 \
  --query 'cluster.accessConfig.authenticationMode' \
  --output text)"

case "$authentication_mode" in
  CONFIG_MAP|API_AND_CONFIG_MAP) ;;
  API)
    echo 'STOP: nonprod is API-only; this runbook cannot modify its authentication' >&2
    exit 1
    ;;
  *)
    echo "STOP: unexpected authentication mode: $authentication_mode" >&2
    exit 1
    ;;
esac
```

An API-only result is a hard stop. Do not introduce another authentication
mechanism or change the cluster authentication mode as part of this catalog
rollout.

## 2. Create the environment IAM role

From this catalog checkout, set `agent_operator_checkout` to an
`agent-operator-v0.9.0` checkout and deploy the shared template with this
catalog's reviewed parameters:

```sh
agent_operator_checkout=/path/to/agent-operator-v0.9.0

aws cloudformation deploy \
  --stack-name catalog-deploy-ai-outfitter-nonprod \
  --template-file "$agent_operator_checkout/actions/deploy-catalog/aws/identity-stack.yaml" \
  --parameter-overrides file://deploy/identity/nonprod.parameters.json \
  --capabilities CAPABILITY_NAMED_IAM
```

The stack creates `ai-outfitter-catalog-deploy-nonprod`, trusts only
`repo:ai-outfitter/.agents:ref:refs/heads/main`, and grants only
`eks:DescribeCluster` for `nonprod`. It reuses the account's existing GitHub
OIDC provider; it does not create another provider.

## 3. Map the role through `aws-auth`

Apply the reviewed eksctl `iamIdentityMappings` configuration. The mapping
uses the same value for role name, Kubernetes username, and Kubernetes group,
and `noDuplicateARNs: true` prevents a second mapping for this role ARN.

```sh
eksctl create iamidentitymapping \
  --config-file deploy/identity/nonprod.aws-auth.yaml
```

Confirm the resulting `aws-auth` entry names
`ai-outfitter-catalog-deploy-nonprod` as both username and group before
continuing.

## 4. Cluster authorization

```sh
kubectl apply -f deploy/rbac.yaml
```

`deploy/rbac.yaml` temporarily binds both
`ai-outfitter-catalog-deploy-nonprod` and the legacy
`ai-outfitter-catalog-deploy` group. Apply these dual bindings before the
workflow assumes the new role so either workflow revision remains authorized
during the cutover. The IAM role, `aws-auth` mapping, workflow, session name,
and field manager use only the new environment-scoped identity.

Do not remove the legacy subjects in this migration PR. A later cleanup PR
MUST remove them from every ClusterRoleBinding and RoleBinding only after the
new role completes two successful workflow runs with distinct GitHub OIDC
sessions and passes a negative authorization test proving it cannot read
Secrets, create or delete Agents, or modify another organization's Agents.
Keep the legacy IAM role and `aws-auth` mapping until that cleanup is ready so
rollback remains a workflow ARN change.

## 5. Per-deployment secrets: two GitHub tokens each, for luce and vega

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

## 6. Namespace, Secret, and image-pull setup — the rest of the checklist

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
