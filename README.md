# .agents

Org-wide agent configuration for the **ai-outfitter** organization: the shared
`.agents` files for contributing to and developing ai-outfitter projects.

- [`AGENTS.md`](AGENTS.md) — development conventions agents (and humans)
  follow across the org's repositories.
- [`settings.yml`](settings.yml) — org-default Outfitter settings: harness and
  the pinned community-profiles catalog source.
- `luce` and `vega` come directly from the release-tagged
  [community-profiles](https://github.com/ai-outfitter/community-profiles)
  source declared by this catalog. This catalog does not fork or rename either
  persona.
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

## Deploying this org's agents

`clusters.yaml`, `.github/workflows/deploy.yml`, and `deploy/` are this
catalog's own CI/CD: a push to `main` deploys Luce and Vega to
this organization's nonprod cluster. Each renders with this catalog's
deployment prefix (`outfitter`) — `outfitter-luce` and `outfitter-vega` —
never a shared object with another catalog's
deployment of the same persona. See [`deploy/RUNBOOK.md`](deploy/RUNBOOK.md)
for administrator bootstrap.

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
