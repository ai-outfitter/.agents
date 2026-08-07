# ai-outfitter — agentic SDLC baseline report (2026-08-07)

Companion to [sdlc-report.json](sdlc-report.json), validated against the
`sdlc-report` skill schema. Scope: all 17 repos of the GitHub org
`ai-outfitter`, private repos included, no sampling. Evidence sources: the
GitHub API (inventory, workflows, rulesets, PR metrics) and local checkouts
under `~/repos/ai-outfitter/` (instruction files, `.agents/` trees, docs);
each claim in the JSON names its source.

## Verdict

**Org maturity: level 2 (delegated), with a level-3 pilot cluster.**

The org consistently practices delegated development: 11 of 17 repos carry
root `AGENTS.md`/`CLAUDE.md` instruction files, a pinned shared catalog exists
(`.agents/settings.yml` pins `default-profiles` and `community-profiles` at
v1.0.0, default harness `pi`), and the merged-PR cadence — median 29 minutes
from open to merge across 154 PRs in 90 days — reflects agent-authored PRs
with a human merging. Five repos already run level-3 automation: issue-
triggered triage agents (outfitter, community-profiles, default-profiles),
scheduled wiki-maintenance and weekly-KPI agents (wiki), and an attested
benchmark fixture (evals), all with transcript or report capture. But that is
a pilot, not the org level: 12 of 17 repos have no CI agent workflow, only
outfitter has required checks, a merge queue, and automatic agent review, and
session records live only in expiring CI artifacts.

## Evidence highlights

- **Context layer.** Instruction files in 11/17 repos; `.agents/` trees in 4
  (agent-operator, wiki, chapters, deepwork). Docs range from strong
  (outfitter: 63 docs files; agent-operator: architecture, requirements,
  runbooks; link: mission-traced requirements) to thin (extension packages,
  `.github`).
- **Automation.** `outfitter/.github/workflows/issue-triage.yml` is the
  flagship: issue trigger, GitHub Models inference on the workflow's own
  token, SHA-pinned side-effect validation, transcript artifact linked on the
  triage comment. The wiki repo runs nightly (ingest-or-lint; lint findings as
  PRs, never self-merged) and weekly KPI agents on an OpenAI key. evals runs a
  fully pinned, attested benchmark fixture.
- **Review posture.** outfitter alone has active rulesets: required status
  checks, a merge queue, and automatic Copilot code review, plus a
  `.deepreview` adversarial review config for release workflows. Every other
  repo's `main` returned 404 "Branch not protected".
- **Governance.** Three shared catalogs, all pinned (`.agents`,
  `default-profiles` v1.0.0, `community-profiles` v1.0.0). Audit record:
  scattered — per-run CI artifacts plus reports committed to the wiki repo.
- **Metrics** (90-day window, ≤50 merged PRs/repo): 154 merged PRs; median
  cycle 0.02 days; rework rate 0.247 (fraction of merged PRs with ≥1 review
  thread); 32.5% of merged PRs had at least one review.

## Gaps

1. `ai-outfitter/actions@v1` is incompatible with outfitter >=1.0.0 — the wiki
   workflows invoke the CLI directly as a workaround; v2 does not exist yet.
2. The issue-triage skill is triplicated (outfitter in-repo profile,
   community-profiles catalog, default-profiles workflow); wiki tooling is
   duplicated between agent-operator and the wiki repo.
3. No branch protection outside outfitter; the wiki nightly agent pushes
   directly to `main`.
4. Session transcripts exist only as expiring CI artifacts; no durable
   org-owned audit record beyond the wiki repo's committed reports.
5. No preview environments found anywhere; smoke-test CI is present in most
   active repos but required nowhere.

## Recommendations (each targets the next rung, level 3)

1. **Consolidate the duplicated issue-triage and wiki skills into the pinned
   catalogs** (low effort). One catalog entry consumed via the already-pinned
   sources beats three private copies and makes every later rollout a
   one-line source reference.
2. **Ship `ai-outfitter/actions@v2`, then roll the proven issue-triage
   workflow to the remaining active repos** (medium). The workflow is proven
   end to end; the action incompatibility is the single blocker to copying
   it — generalize the one workflow that already works, don't invent new ones.
3. **Extend required checks and agent review beyond outfitter, starting with
   repos agents push to** (low). Replicate outfitter's ruleset shape
   (required checks, merge queue, Copilot review) to wiki, community-profiles,
   and default-profiles first — adversarial review as a pipeline step is what
   level 3 requires.
4. **Make session capture durable before merge** (medium). Route transcript
   exports into a permanent store — the wiki repo is the natural home — so
   scattered artifacts become the audit record level 4 builds on and level-5
   evals feed from.

## Evidence limits

See `evidence_limits` in the JSON. Chief among them: local checkouts lag
origin by up to two months (API preferred for workflow facts); vendor
dashboards and org-level settings were not inspected; PR metrics are a lower
bound where the 50-PR cap bit (outfitter); local-only harness sessions are
invisible — "no session capture found" is absence of evidence, not a negative
fact; and the design-stage agent-operator cluster runtime was not observed
running.

## Re-run cadence

Re-run the assessment after each rung change or quarterly into a new dated
directory beside this one; diff the JSON for cycle time, rework rate, and
rung movements.
