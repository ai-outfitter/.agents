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

Reports land under [`reports/kpis/`](reports/kpis/). Inference uses the
`ANTHROPIC_API_KEY` Actions secret. (GitHub Models is not usable here: it
returns 403 for enterprise-owned org repos in Unsupervised, with no Models
enablement surface at repo, org, or enterprise level as of July 2026.)

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
