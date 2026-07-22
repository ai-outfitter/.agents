# ai-outfitter/.outfitter

The ai-outfitter organization's shared [Outfitter](https://github.com/ai-outfitter/outfitter)
catalog: the profiles and skills our internal agents use across the
organization's repositories, plus the org automation built on them.

## Layout

```text
weekly.md                       # pointer to the current week's report
profiles/
  github-actions/profile.yml    # shared profile for CI-launched agents
skills/
  reports/
    SKILL.md                    # routes trigger_context.report_kind to a flow
    scripts/                    # collect, backfill, render, publish
    assets/template.weekly-report.md
reports/
  <YYYY>-W<WW>/
    kpis.json                   # machine-readable weekly snapshot
    report.md                   # rendered weekly status report
docs/
  personas/                     # org review personas (data) for reviewing Outfitter
    roles/, individuals/        # kind: role / kind: individual, run via community-profiles' reviewer
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

- **Manual runs** (`workflow_dispatch`, any day) regenerate the current ISO
  week's report as a `draft` — use this to test the pipeline.
- **Sunday's scheduled run** regenerates one last time and marks the report
  `final`.

Each week lands in `reports/<YYYY>-W<WW>/` as `kpis.json` (machine state,
including release/merge activity and release-please status) plus `report.md`
(rendered deterministically by `scripts/render-weekly-report.sh` — the agent
writes only the Highlights paragraph). Root [`weekly.md`](weekly.md) always
points at the current week. Week-over-week deltas come from the previous
week's `kpis.json`; when it doesn't exist, `scripts/backfill-week.sh`
reconstructs stars/forks/commits from timestamped data. Adding a new report
kind means a new template + scripts + one routing bullet in the `reports`
skill, and a workflow (or input) that passes the new `report_kind`.

Inference uses the workflow's own token via GitHub Models (`models: read`) —
no API-key secrets. The provider config points at the legacy endpoint
`models.inference.ai.azure.com` because the newer `models.github.ai/inference`
gateway rejects Actions tokens from enterprise-owned org repos (HTTP 403).
Free-tier limits shape the skill: 15 model requests/minute and 8000-token
request bodies, hence one batched collector script and compact tool output.

## Review personas

[`docs/personas/`](docs/personas/) holds the org's shared platform persona
(`platform-engineer` / `theo-alvarez`) for reviewing Outfitter's own docs,
onboarding, and CLI from a target user's viewpoint. The persona docs are data;
the review method is the `reviewer` agent + `persona-review` skill in
[`ai-outfitter/community-profiles`](https://github.com/ai-outfitter/community-profiles).
See [`docs/personas/README.md`](docs/personas/README.md) for the field schema and
how to run a one-off review.

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
