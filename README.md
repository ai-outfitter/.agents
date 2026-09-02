# .agents

Org-wide agent configuration for the **ai-outfitter** organization: the shared
`.agents` files for contributing to and developing ai-outfitter projects.

- [`AGENTS.md`](AGENTS.md) — development conventions agents (and humans)
  follow across the org's repositories.
- [`settings.yml`](settings.yml) — org-default Outfitter settings: harness and
  the pinned community-profiles catalog source.
- [`agents/luce-ai-outfitter`](agents/luce-ai-outfitter/agent.md) — the org's
  resident agent: inherits the canonical `luce` profile from the pinned
  community catalog, then adds this organization's credential context. Luce
  implements assigned issues and independently reviews pull requests.
- [`agents/vega-ai-outfitter`](agents/vega-ai-outfitter/agent.md) — the org's
  Vega overlay: inherits the canonical community persona and adds this
  organization's runtime and credential context.
- Drago (research engineer) is planned but not yet deployed.
- More shared contributor agents and skills land here as they emerge; broader
  catalogs live in
  [community-profiles](https://github.com/ai-outfitter/community-profiles).

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
