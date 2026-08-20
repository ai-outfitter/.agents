# .agents

Org-wide agent configuration for the **ai-outfitter** organization: the shared
`.agents` files for contributing to and developing ai-outfitter projects.

- [`AGENTS.md`](AGENTS.md) — development conventions agents (and humans)
  follow across the org's repositories.
- [`settings.yml`](settings.yml) — org-default Outfitter settings: harness and
  the pinned community-profiles catalog source.
- [`agents/outfitter-bot`](agents/outfitter-bot/agent.md) — the org's resident
  agent: works issues assigned to it into reviewed pull requests.
- [`agents/luce`](agents/luce/agent.md) — the org's resident agent: triages a
  report into a scoped issue with acceptance criteria, then works the issues
  assigned to it into pull requests. Luce is a persona shared across
  organizations; each deployment holds credentials for its own organization
  only.
- [`agents/vega`](agents/vega/agent.md) — the org's resident agent: reviews
  pull requests for correctness, failure modes, and test coverage. Vega is a
  persona shared across organizations, deployed the same way as Luce.
- Drago (research engineer) is planned but not yet deployed.
- More shared contributor agents and skills land here as they emerge; broader
  catalogs live in
  [community-profiles](https://github.com/ai-outfitter/community-profiles).

## Deploying this org's agents

`clusters.yaml`, `.github/workflows/deploy.yml`, and `deploy/` are this
catalog's own CI/CD: a push to `main` deploys Luce, Vega, and outfitter-bot to
this organization's nonprod cluster. Each renders with this catalog's
deployment prefix (`outfitter`) — `outfitter-luce`, `outfitter-vega`,
`outfitter-outfitter-bot` — never a shared object with another catalog's
deployment of the same persona. See [`deploy/RUNBOOK.md`](deploy/RUNBOOK.md)
for administrator bootstrap.

`Unsupervisedcom/.agents` no longer deploys this organization's agents; it did
so as a guest until this catalog's own CI/CD existed. See
`deploy/RUNBOOK.md`'s migration section.

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

## History

This repository was previously `ai-outfitter/.outfitter` and carried the
weekly org KPI automation. That machinery — workflow, reports skill, and the
generated reports — now lives in
[ai-outfitter/wiki](https://github.com/ai-outfitter/wiki).
