# Duplicate resident retirement

Canonical residents are managed by Unsupervisedcom/.agents. Keep the existing
`unsupervised-luce`, `unsupervised-vega`, and `unsupervised-nonprod-bot` identities;
their nonprod manifests use `unsupervised` first and `outfitter` second. Apply
those manifests only after the reviewed multi-membership operator is deployed.
The Slack/Grafana bots retain their existing read-only restrictions.

This catalog's nonprod deploy list is empty and the former deploy workflow has
no AWS identity or deployment step. This prevents CI from reconciling duplicate
Agents back into service. Historical Agent manifests remain as records; do not
apply them. Keep the `outfitter` Organization and forge gateway configuration:
canonical membership and explicit owner checks provide cross-organization access,
not a shared unrestricted token.

Catalog changes do not delete running Agents. Before an administrator retires
`outfitter-luce` and `outfitter-vega`, preserve required Secrets and persistent
data, verify the canonical residents and organization subscriptions, and disable
old intake to avoid duplicate replies. Retire the old catalog deploy IAM trust
and administrator-applied RBAC (`deploy/rbac.yaml`) when no longer needed; do
not remove the Organization gateway privileges required by canonical residents. The operator's Agent finalizer explicitly
deletes the namespace, so orphan propagation does not preserve it. Confirm
namespace/PVC backups before deletion and verify no duplicate CR is recreated.

The local factory registry is deliberately unroutable (`needs-human` fallback).
Its schema calls inactive entries `planned`; this is not a deployment request.
Only enable canonical routing after the corresponding live gateway and identity
bindings have been validated.
