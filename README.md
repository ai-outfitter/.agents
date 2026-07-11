# ai-outfitter/.outfitter

The ai-outfitter organization's shared [Outfitter](https://github.com/ai-outfitter/outfitter)
catalog: the profiles and skills our internal agents use across the
organization's repositories, plus the org automation built on them.

## Layout

```text
profiles/
  outfitter-developer/profile.yml   # shared org profile for internal agents
skills/
  kpi-reporting/SKILL.md            # weekly org KPI report skill
reports/
  kpis/<YYYY>-W<WW>.md              # one report per ISO week
.github/workflows/
  weekly-kpis.yml                   # Sunday schedule + manual dispatch
```

## Weekly KPIs

[`weekly-kpis.yml`](.github/workflows/weekly-kpis.yml) runs
[`ai-outfitter/actions`](https://github.com/ai-outfitter/actions) with the
`outfitter-developer` profile, which routes the run to the `kpi-reporting`
skill:

- **Manual runs** (`workflow_dispatch`, any day) refresh the current ISO
  week's report as a `draft` — use this to test the pipeline.
- **Sunday's scheduled run** refreshes the numbers one last time and marks the
  report `final`.

Reports land under [`reports/kpis/`](reports/kpis/). Inference runs on
[GitHub Models](https://docs.github.com/en/github-models) authenticated by the
workflow's own token (`models: read`) — no API-key secrets required. To use a
paid provider instead, change the profile's `provider`/`model` controls and
pass the provider key as `env:` on the action step.

## Consuming this catalog

Add it as a profile source in a project's `.outfitter/settings.yml` or your
`~/.outfitter/settings.yml`:

```yaml
profile_sources:
  - github: ai-outfitter/.outfitter
```

Then launch with `outfitter run --profile outfitter-developer`, or select a
skill by id (e.g. `kpi-reporting`) from your own profile's `controls.skills`.
In GitHub Actions, point `ai-outfitter/actions` at it:

```yaml
- uses: ai-outfitter/actions@v1
  with:
    profile: outfitter-developer
    profile-source: ai-outfitter/.outfitter
```
