# .agents

Org-wide agent configuration for the **ai-outfitter** organization: the shared
`.agents` files for contributing to and developing ai-outfitter projects.

- [`AGENTS.md`](AGENTS.md) — development conventions agents (and humans)
  follow across the org's repositories.
- [`settings.yml`](settings.yml) — org-default Outfitter settings: harness and
  the pinned catalog sources (default-profiles, community-profiles).
- Shared contributor agents and skills land here as they emerge; broader
  catalogs live in
  [default-profiles](https://github.com/ai-outfitter/default-profiles) and
  [community-profiles](https://github.com/ai-outfitter/community-profiles).

## Using it

Link this repo as a source in your own `.agents/settings.yml` (or `~/.agents/settings.yml`):

```yaml
sources:
  - github: ai-outfitter/.agents
    ref: <tag-or-commit>
```

## History

This repository was previously `ai-outfitter/.outfitter` and carried the
weekly org KPI automation. That machinery — workflow, reports skill, and the
generated reports — now lives in
[ai-outfitter/wiki](https://github.com/ai-outfitter/wiki).
