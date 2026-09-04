# Deploying the ai-outfitter fleet

`clusters.yaml` names two agents on the `nonprod` cluster: `luce` and `vega`.
`.github/workflows/deploy.yml` assumes a dedicated IAM role
through GitHub OIDC and runs the `deploy-catalog` action once, deploying
exactly that set. CI only **moves objects that already exist**; this document
is what an administrator does once, by hand, before the first deploy of a new
agent.

## 1. IAM role for the deploy identity

Create `ai-outfitter-catalog-deploy` in account `216577824627` (the account the
shared nonprod cluster lives in), trusted only by this repository on `main`.

Trust policy condition:

```json
{
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": [
      "repo:ai-outfitter/.agents:ref:refs/heads/main",
      "repo:ai-outfitter@294932028/.agents@1296989777:ref:refs/heads/main"
    ]
  }
}
```

GitHub currently emits the immutable ID-based subject for this organization.
Keep the readable subject as migration-safe fallback, but deployment MUST be
tested against the immutable subject after creating or replacing the role.

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
| `GITHUB_PERSONAL_ACCESS_TOKEN` | fine-grained PAT | resource owner **`ai-outfitter`** only; selected repositories; Contents, Issues, and Pull requests read/write; Metadata read |
| `GITHUB_USER` | — | the machine account's login |

**Why they stay two tokens.** `GET /notifications` accepts classic tokens
only — a fine-grained PAT and an App installation token are both rejected
with `403`. Collapsing to one classic token with `repo` would grant write
access to code, collaborators, and webhooks on every repository the shared
account can reach, in every organization it belongs to — classic scopes have
no organization selector.

Each agent has one `agent-credentials` Secret for its GitHub identity. The
Agent resource carries channel selection, organization filtering, polling, and
event filters through the operator's typed `channels` and `github` fields:

```sh
kubectl create namespace agent-outfitter-luce

kubectl -n agent-outfitter-luce create secret generic agent-credentials \
  --from-literal=GITHUB_NOTIFY_TOKEN='ghp_replace_with_the_classic_notifications_token' \
  --from-literal=GITHUB_PERSONAL_ACCESS_TOKEN='github_pat_replace_with_the_fine_grained_token' \
  --from-literal=GITHUB_USER='luce-unsup'

```

Repeat for `agent-outfitter-vega` with `vega-unsup`.

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

Every machine account MUST enable an organization-approved secure 2FA method
(authenticator app, GitHub Mobile, security key, or passkey). SMS-only or
missing 2FA causes GitHub to return `403` for repository access even when the
PAT itself is valid. Verify from the runtime with a read-only request before
accepting the deployment; `/notifications` returning `200` is insufficient.

Protect `main` on every repository Luce or Vega works, the same way as any
other deployment of these personas — see the community-profiles catalog's
own Luce documentation for the exact ruleset; the boundary is enforced by the
forge, not by the token or the profile.

## 5. Namespace, Secret, and image-pull setup — the rest of the checklist

Install Agent Operator v0.12 before applying this catalog. Confirm both fields
exist with `kubectl explain organizations.spec.credentialSecretName` and
`kubectl explain agents.spec.credentialSecretName`.

Every Agent pins the same version-tagged public runtime,
`ghcr.io/ai-outfitter/outfitter:1.15.0`. GitHub is reached through the hosted
MCP endpoint (`github-hosted`), so the image needs no `github-mcp-server`. Do
not use the moving `latest` tag or fall back to the operator's stock image. Managed catalog sync writes
Outfitter's versioned source-state manifests for the exact revisions it
fetches before the resident runtime starts.

Create `secret/organization-credentials` once in namespace `org-outfitter`
with `default.SPARK_AUTHORIZATION` set to the complete Basic Authorization
header consumed by `models.json`. Agent Operator v0.12 inherits it into every
member Agent as `SPARK_AUTHORIZATION`; never print it or store it in this
repository.

For each agent (`outfitter-luce`, `outfitter-vega`):

1. Create the namespace `agent-<agent-name>` (the operator also creates it on
   first apply via the Agent's owner reference, but creating it first lets
   the Secret exist before the first deploy).
2. Create `secret/agent-credentials` with the keys in the table above. Do not
   add `OPENAI_API_KEY` or a directly managed `SPARK_AUTHORIZATION`.
3. Create `secret/ghcr-pull` and patch the `agent-runtime` ServiceAccount with
   it because the runtime image is private:

   ```sh
   kubectl -n agent-<agent-name> patch serviceaccount agent-runtime \
     -p '{"imagePullSecrets":[{"name":"ghcr-pull"}]}'
   ```

4. Apply this catalog once (`workflow_dispatch`, or push to `main`).
   `catalogSync.enabled` runs managed `outfitter sync` before the resident
   runtime. Wait for `Ready` with the expected resolved revision, then assign
   one test issue and request one cross-resident review. The author produces a
   tested pull request, the other resident submits `REQUEST_CHANGES` or
   `APPROVE`, and a maintainer owns merge.

After reconciliation, each `agent-credentials` Secret MUST contain
`SPARK_AUTHORIZATION` inherited from the organization. Channel configuration
MUST resolve from the typed Agent fields.

## Failure modes worth recognising

- **`AssumeRoleWithWebIdentity` fails** — the OIDC subject changed. Renaming
  the workflow file, adding a job `environment:`, or deploying from a branch
  other than `main` mints an identity the trust policy does not accept.
- **`deploy: forbidden authorization was granted`** — RBAC drifted *wider*
  than intended. This is the check that catches a mistake nothing else would
  surface.
- **Agent never converges** — `Ready` is true but the resolved revision is
  not ours, meaning the pod is still serving the previous profile.
- **Starts cleanly, never wakes** — token wrong or expired, filters exclude
  the reason, or the account is not assignable on that repository. None of
  these produces an error or a stack trace; treat token-expiry mail as an
  operational alert.
