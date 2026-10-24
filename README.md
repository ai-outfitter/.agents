# .agents

Org-wide agent configuration for the **ai-outfitter** organization: the shared
`.agents` files for contributing to and developing ai-outfitter projects.

- [`AGENTS.md`](AGENTS.md) — development conventions agents (and humans)
  follow across the org's repositories.
- [`settings.yml`](settings.yml) — org-default Outfitter settings: harness and
  the pinned community-profiles catalog source.
- `luce` and `vega` come directly from the release-tagged
  [community-profiles](https://github.com/ai-outfitter/community-profiles)
  source declared by this catalog for contributor use. Canonical resident
  deployment belongs to Unsupervisedcom/.agents.
- The community profiles supply Channels, task-plane tools, and hosted GitHub
  access. Each deployment selects its organization-owned model through the
  Agent profile without forking or renaming the persona.
- Drago (research engineer) is planned but not yet deployed.
- More shared contributor agents and skills land here as they emerge; broader
  catalogs live in
  [community-profiles](https://github.com/ai-outfitter/community-profiles).
- [`factory/agents.json`](factory/agents.json) is the App-facing routing
  registry. Only entries marked both `deployed` and `routable` may receive
  an issue. Each routable implementer names a different deployed reviewer.
  `bin/validate-factory-policy` checks those invariants against the schema,
  cluster list, Agent manifests, and governance. Maintainer approval remains a merge gate.

## Canonical residents

`Unsupervisedcom/.agents` owns the canonical residents that serve both
`Unsupervisedcom` and `ai-outfitter`. This catalog no longer deploys duplicate
`outfitter-luce` or `outfitter-vega` Agents: `clusters.yaml` is empty and the
former deploy workflow makes no cluster changes. Local factory routes remain
unroutable with `needs-human` fallback until canonical routing is configured.
The `planned` registry state is inactive, not a request to recreate duplicates.

Keep the `outfitter` Organization and its forge gateway configuration so it can
route to canonical residents with an `outfitter` membership. Retirement of the
old Agents is a separate administrator operation: the operator finalizer deletes
their namespaces and PVCs even with orphan propagation. Preserve required data
before deletion. See [`deploy/RETIREMENT.md`](deploy/RETIREMENT.md).

## Using it

Inside the ai-outfitter org, declare this repo unpinned as the repo's ONLY
source in `.agents/settings.yml`:

```yaml
sources:
  - github: ai-outfitter/.agents
```

In workflows that use `ai-outfitter/actions`, also pass
`source: ai-outfitter/.agents` on the action step — a repo with its own
`.agents/` otherwise skips `outfitter sync` and never fetches this catalog.

See [Catalog sources](AGENTS.md#catalog-sources) for the org-wide rule.

Outside the org, pin this repo in `.agents/settings.yml` (or
`~/.agents/settings.yml`):

```yaml
sources:
  - github: ai-outfitter/.agents
    ref: <tag-or-commit>
```

You don't own this catalog; leaving it unpinned runs whatever is published
next.
