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

## 4. Cluster credentials

Credentials live directly in namespace-scoped Kubernetes Secrets. They are
not backed up in this repository and no workflow creates or updates them.
Provision or rotate them directly in the cluster through the administrator's
normal secret-entry surface. Do not put credential values in this runbook,
shell history, a GitHub Actions input, or a committed file.

The required live contract is:

| Source subtree | Kubernetes target | Keys |
| --- | --- | --- |
| Organization model | `org-outfitter/organization-credentials` | `default.SPARK_AUTHORIZATION` |
| Luce administrator input | `agent-outfitter-luce/agent-credentials` | `GITHUB_NOTIFY_TOKEN`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `GITHUB_USER`, `a2a-credentials.json` |
| Vega administrator input | `agent-outfitter-vega/agent-credentials` | the same four keys |

Do not populate `SPARK_AUTHORIZATION` in either Agent Secret. Agent Operator
inherits it from `default.SPARK_AUTHORIZATION`; a directly populated child key
is an intentional per-Agent override and no longer follows organization-level
rotation. After reconciliation, verify `SPARK_AUTHORIZATION` exists as an
operator-reconciled postcondition in each Agent Secret.

Verify key names without reading values:

```sh
kubectl -n org-outfitter get secret organization-credentials -o go-template='{{range $key, $_ := .data}}{{$key}}{{"\n"}}{{end}}'
kubectl -n agent-outfitter-luce get secret agent-credentials -o go-template='{{range $key, $_ := .data}}{{$key}}{{"\n"}}{{end}}'
kubectl -n agent-outfitter-vega get secret agent-credentials -o go-template='{{range $key, $_ := .data}}{{$key}}{{"\n"}}{{end}}'
```

Luce and Vega use separate organization-scoped GitHub credentials even though
their machine-account identities are shared. `GITHUB_NOTIFY_TOKEN` is a
classic token limited to `notifications`; `GITHUB_PERSONAL_ACCESS_TOKEN` is a
fine-grained token owned by `ai-outfitter` with only repository Contents,
Issues, Pull requests, and Metadata access. The A2A document is unique to each
resident. Agent Operator inherits `default.SPARK_AUTHORIZATION` from the
organization Secret into each resident as `SPARK_AUTHORIZATION`.

## 5. Deploy and accept the residents

Install Agent Operator `agent-operator-v0.15.1` before applying this catalog.
Confirm the required API with `kubectl explain agents.spec.taskPlane.workflow`
and `kubectl explain agents.spec.profile.model`.

Every Agent pins `ghcr.io/ai-outfitter/outfitter:1.16.0`. Managed catalog sync
fetches the exact `.agents` and community-profiles revisions before startup;
the task-plane init container then strictly exports `software-factory`.

Protect the default branch in every repository the residents can modify. The
ruleset must reject direct pushes from `luce-unsup` and `vega-unsup` and require
the repository's CI and independent review gates. This forge-enforced rule is
what makes the maintainer the only merge actor; the profile and token alone do
not enforce it.

Push the reviewed catalog to `main` and wait for the deploy workflow. Accept
the deployment only when both Agents report `Ready=True`, their catalog source
revisions match the merge commit, and their runtime pods are available. Then
exercise one issue assignment and one cross-resident review. The assigned
resident must produce a tested pull request, the other resident must submit an
independent verdict on the current head, and a maintainer remains the only
merge actor.

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
