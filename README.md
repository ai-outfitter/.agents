# ai-outfitter/.outfitter

The ai-outfitter organization's shared [Outfitter](https://github.com/ai-outfitter/outfitter)
catalog: the profiles and skills our internal agents use across the
organization's repositories, plus the org automation built on them.

## Layout

```text
profiles/
  github-actions/profile.yml    # shared profile for CI-launched agents
skills/
  reports/
    SKILL.md                    # routes trigger_context.report_kind to a flow
    scripts/collect-weekly-kpis.sh
    assets/weekly-kpi.md        # report template
reports/
  kpis/<YYYY>-W<WW>.md          # one report per ISO week
.github/workflows/
  weekly-kpis.yml               # Sunday schedule + manual dispatch
```

## Weekly KPIs

[`weekly-kpis.yml`](.github/workflows/weekly-kpis.yml) runs
[`ai-outfitter/actions`](https://github.com/ai-outfitter/actions) with the
`github-actions` profile. The prompt carries only workflow-owned
`trigger_context` (`report_kind: weekly-kpi`); the profile activates the
`reports` skill, which routes that kind to its flow, collector script, and
template:

- **Manual runs** (`workflow_dispatch`, any day) refresh the current ISO
  week's report as a `draft` — use this to test the pipeline.
- **Sunday's scheduled run** refreshes the numbers one last time and marks the
  report `final`.

Reports land under [`reports/kpis/`](reports/kpis/). Adding a new report kind
means a new template + collector + one routing bullet in the `reports` skill,
and a workflow (or workflow input) that passes the new `report_kind`.

Inference uses the workflow's own token via GitHub Models (`models: read`) —
no API-key secrets. The provider config points at the legacy endpoint
`models.inference.ai.azure.com` because the newer `models.github.ai/inference`
gateway rejects Actions tokens from enterprise-owned org repos (HTTP 403).
Free-tier limits shape the skill: 15 model requests/minute and 8000-token
request bodies, hence one batched collector script and compact tool output.

## Consuming this catalog

Add it as a profile source in a project's `.outfitter/settings.yml` or your
`~/.outfitter/settings.yml`:

```yaml
profile_sources:
  - github: ai-outfitter/.outfitter
```

Then launch with `outfitter run --profile github-actions`, or select a skill
by id (e.g. `reports`) from your own profile's `controls.skills`. In GitHub
Actions, point `ai-outfitter/actions` at it:

```yaml
- uses: ai-outfitter/actions@v1
  with:
    profile: github-actions
    profile-source: ai-outfitter/.outfitter
```
