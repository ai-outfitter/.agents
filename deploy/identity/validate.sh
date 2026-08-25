#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
parameters="$repo_root/deploy/identity/nonprod.parameters.json"
mapping="$repo_root/deploy/identity/nonprod.aws-auth.yaml"
workflow="$repo_root/.github/workflows/deploy.yml"
rbac="$repo_root/deploy/rbac.yaml"

parameter() {
  jq -er --arg key "$1" '.[] | select(.ParameterKey == $key) | .ParameterValue' "$parameters"
}

organization="$(parameter OrganizationSlug)"
environment="$(parameter Environment)"
cluster="$(parameter ClusterName)"
oidc_provider="$(parameter OidcProviderArn)"
account_id="$(sed -nE 's#^arn:aws:iam::([0-9]{12}):oidc-provider/.+$#\1#p' <<<"$oidc_provider")"
identity="${organization}-catalog-deploy-${environment}"
legacy_identity="${organization}-catalog-deploy"
role_arn="arn:aws:iam::${account_id}:role/${identity}"

[[ -n "$account_id" ]]
[[ "$(parameter GitHubOrganization)" == "ai-outfitter" ]]
[[ "$(parameter GitHubRepository)" == ".agents" ]]
[[ "$(parameter GitHubRef)" == "refs/heads/main" ]]
[[ "$cluster" == "nonprod" ]]

grep -Fqx "  name: $cluster" "$mapping"
grep -Fqx "  - arn: $role_arn" "$mapping"
grep -Fqx "    username: $identity" "$mapping"
grep -Fqx "      - $identity" "$mapping"
grep -Fqx "    noDuplicateARNs: true" "$mapping"

grep -Fq "role-to-assume: $role_arn" "$workflow"
grep -Fq "role-session-name: $identity" "$workflow"
grep -Fq "assumed-role/$identity/" "$workflow"
grep -Fq "field-manager: $identity" "$workflow"
if grep -Eq "${legacy_identity}([/\"'[:space:]]|$)" "$workflow"; then
  echo "workflow still uses the legacy deploy identity" >&2
  exit 1
fi

if grep -Eq "${legacy_identity}([/\"'[:space:]]|$)" "$mapping"; then
  echo "aws-auth mapping still uses the legacy deploy identity" >&2
  exit 1
fi

if grep -E '^  name: .*catalog-deploy' "$rbac" | grep -Fvx "  name: $identity"; then
  echo "deploy RBAC contains a non-standard identity name" >&2
  exit 1
fi

if grep -E '^    name: .*catalog-deploy' "$rbac" \
  | grep -Fvx -e "    name: $identity" -e "    name: $legacy_identity"; then
  echo "deploy RBAC contains an unexpected roleRef or subject" >&2
  exit 1
fi

[[ "$(grep -Ec "^  name: $identity$" "$rbac")" -eq 12 ]]
[[ "$(grep -Ec "^    name: $identity$" "$rbac")" -eq 4 ]]
[[ "$(grep -Ec "^    name: $legacy_identity$" "$rbac")" -eq 4 ]]

echo "identity configuration is consistent: $identity"
