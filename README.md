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
.github/workflows/
  ci.yml                        # validates deterministic automation
  weekly-kpis.yml               # Sunday schedule + manual dispatch
  dependabot-merge-queue.yml    # preview/rebase/queue Dependabot PRs
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

## Dependabot merge queue

[`dependabot-merge-queue.yml`](.github/workflows/dependabot-merge-queue.yml)
is a manual, deterministic controller for one `ai-outfitter` repository at a
time. It discovers every open, non-draft Dependabot PR targeting the default
branch (or uses an explicit ordered list), rebases every selected branch that is
behind, verifies that the entire batch is current, and only then submits the
clean batch directly to that repository's merge queue in the requested order.
Conflicting, ineligible, or failing PRs stop the batch before any PR is queued.
A preview is the default; turn on the `execute` input to apply it.

Each target repository needs these one-time prerequisites:

1. Enable **Allow auto-merge** and configure a merge queue on the exact default
   branch, with required checks and no queue jumping.
2. Add the `merge_group` `checks_requested` event to every required Actions
   workflow so the queue's temporary merge groups receive CI results.
3. Install the organization GitHub App with repository **Contents: read and
   write** and **Pull requests: read and write** permissions. Expose its app ID
   as `OUTFITTER_APP_ID` and private key as `OUTFITTER_APP_PRIVATE_KEY` to this
   repository's Actions runs.

The workflow uses the App token because GitHub's built-in `GITHUB_TOKEN` cannot
add PRs to a merge queue. It runs only from this repository's default branch,
checks out no target-repository or PR code, serializes runs per target, verifies
the queue before making changes, and pins every enqueue request to the
post-rebase head commit.

GitHub has no atomic multi-PR enqueue API, so the final queue insertions are a
tight ordered sequence. If an insertion fails after an earlier one succeeds,
the workflow reports the partial result. Rerunning the same batch is safe:
existing queue entries are detected and left in place.

The same preview can be run locally with an authenticated GitHub CLI:

```sh
node .github/scripts/queue-dependabot-prs.mjs \
  --repository ai-outfitter/outfitter
```

Pass an explicit batch and execute it after reviewing the preview:

```sh
node .github/scripts/queue-dependabot-prs.mjs \
  --repository ai-outfitter/outfitter \
  --pull-requests "193,196" \
  --execute
```
