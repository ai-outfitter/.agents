---
week: 2026-W28
status: final
generated_at: 2026-07-12T20:16:38Z
generated_by: https://github.com/ai-outfitter/.outfitter/actions/runs/29207392116
---

# ai-outfitter weekly status — 2026-W28

Week of 2026-07-06 to 2026-07-12. Final.

## Highlights

During week 2026-W28, notable activity in the ai-outfitter organization included the outfitter repository with 11 stars, 2 forks, 2 issues, 24 pull requests (18 merged), and 18 commits. The actions repository saw significant activity with 1 star, 6 pull requests (8 merged), 15 commits, and a new release v1.0.0. Several other repositories showed moderate PR and commit activity, contributing to ongoing development and maintenance efforts across the organization.
## Org totals

| Metric | Value | Δ vs 2026-W27 (backfilled baseline) |
| --- | ---: | ---: |
| Stars | 14 | +9 |
| Forks | 5 | +2 |
| Open issues | 3 | — |
| Open pull requests | 36 | — |
| PRs merged this week | 32 | — |
| Commits this week (default branches) | 74 | +22 |

## Per-repository

| Repository | Stars | Δ | Forks | Δ | Open issues | Open PRs | Commits | Δ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| .outfitter | 0 | 0 | 0 | 0 | 0 | 0 | 32 | +32 |
| outfitter | 11 | +8 | 2 | 0 | 2 | 24 | 18 | -17 |
| actions | 1 | +1 | 0 | 0 | 1 | 6 | 15 | +14 |
| community-profiles | 0 | 0 | 1 | +1 | 0 | 1 | 4 | +4 |
| default-profiles | 1 | 0 | 1 | 0 | 0 | 2 | 3 | -5 |
| .github | 0 | 0 | 0 | 0 | 0 | 1 | 2 | +2 |
| deepwork | 1 | 0 | 1 | +1 | 0 | 2 | 0 | -1 |
| ulta-tasklist | 0 | 0 | 0 | 0 | 0 | 0 | 0 | -1 |
| file-talk | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| bash-saver | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Activity

- **default-profiles** — 3 PRs merged this week — release PR #9 open
- **community-profiles** — 3 PRs merged this week — release PR #3 open
- **actions** — 8 PRs merged this week — 4 unreleased commits since v1.0.0 — release PR #9 open
  - released [v1.0.0](https://github.com/ai-outfitter/actions/releases/tag/v1.0.0)
    - initial Outfitter GitHub Action with token-scoping docs ([f5b8e99](https://github.com/ai-outfitter/actions/commit/f5b8e9913cf35bfe67522c70c136fe1e70ee84b7))
    - Merge pull request [#2](https://github.com/ai-outfitter/actions/issues/2) from ai-outfitter/docs/github-models ([7101c9e](https://github.com/ai-outfitter/actions/commit/7101c9e092a7282cc3a7579f2289b4ba041c127c))
    - Merge pull request [#3](https://github.com/ai-outfitter/actions/issues/3) from ai-outfitter/feat/validate-triage-script ([62876b5](https://github.com/ai-outfitter/actions/commit/62876b52e0477f5d2754c11638d53548c8fab7e1))
    - validate-triage.sh — assert a triage agent's side effects via gh ([8626a94](https://github.com/ai-outfitter/actions/commit/8626a9465170fd14c0f87f52a9147f9f2545ce46))
    - validate-triage.sh — assert triage side effects via gh ([62876b5](https://github.com/ai-outfitter/actions/commit/62876b52e0477f5d2754c11638d53548c8fab7e1))
    - **ci:** use RELEASE_PLEASE_TOKEN so release-please can open PRs ([066d07e](https://github.com/ai-outfitter/actions/commit/066d07e59945f1ffa72b182561561bc1d08951e1))
- **outfitter** — 18 PRs merged this week — 1 unreleased commit since v0.10.0 — release PR #160 open
  - released [v0.10.0](https://github.com/ai-outfitter/outfitter/releases/tag/v0.10.0)
    - **run:** show the active profile in the pi TUI status line ([#145](https://github.com/ai-outfitter/outfitter/issues/145)) ([5015067](https://github.com/ai-outfitter/outfitter/commit/5015067bc8afa0ae13f1ae868018339b71f636eb))
    - **skills:** implement catalog skill selection and reference materialization ([#155](https://github.com/ai-outfitter/outfitter/issues/155)) ([e26f73c](https://github.com/ai-outfitter/outfitter/commit/e26f73ccafefc7c5f0bbad5fc09feed02e3faf52)), closes [#149](https://github.com/ai-outfitter/outfitter/issues/149)
    - **skills:** publish the bundled outfitter self-docs skill to pi and claude launches ([#154](https://github.com/ai-outfitter/outfitter/issues/154)) ([0998e14](https://github.com/ai-outfitter/outfitter/commit/0998e143e6baebcc6617860800aa32142bb63bd1))
  - released [v0.9.0](https://github.com/ai-outfitter/outfitter/releases/tag/v0.9.0)
    - **state:** implement the interactive prompt state-persistence strategy ([#134](https://github.com/ai-outfitter/outfitter/issues/134)) ([d76a085](https://github.com/ai-outfitter/outfitter/commit/d76a08593e3bf5f6038e88599bbfcf2d0fca7cd9))
    - **onboarding:** remove hardcoded bootstrap model from first-run pi launch ([#137](https://github.com/ai-outfitter/outfitter/issues/137)) ([bb1dfbd](https://github.com/ai-outfitter/outfitter/commit/bb1dfbddd88f7332060d061159c99aef5d57ee3e)), closes [#2](https://github.com/ai-outfitter/outfitter/issues/2)
    - **run:** let launches proceed when a remote profile source has never synced ([#140](https://github.com/ai-outfitter/outfitter/issues/140)) ([f3a4a7e](https://github.com/ai-outfitter/outfitter/commit/f3a4a7e6d0274699b75e3093107eccdba7ece059))
    - **state:** clean up composite temp dirs on exit, signals, and startup sweep ([#135](https://github.com/ai-outfitter/outfitter/issues/135)) ([b3f969f](https://github.com/ai-outfitter/outfitter/commit/b3f969f959c060e534ac7adeeb53e74801592b6d))
    - **state:** handle symlink permission errors with a win32-only fallback via SafeSymlink ([#133](https://github.com/ai-outfitter/outfitter/issues/133)) ([20f385a](https://github.com/ai-outfitter/outfitter/commit/20f385a6a4af466124674dfbd086784157460f87))
    - **sync:** resolve nested remote settings files ([#141](https://github.com/ai-outfitter/outfitter/issues/141)) ([68162a5](https://github.com/ai-outfitter/outfitter/commit/68162a56a74cb149e5c916748630bc6789f4101e))
- **deepwork** — 1 unreleased commit since v0.2.1 — release PR #9 open

Notes:

- Traffic (views/clones) omitted: requires push access per repository from
  the run's token.
- Commit counts cover each repository's default branch since Monday 00:00 UTC.
- Private org repositories other than the one this workflow runs in are not
  visible to the workflow token and are excluded.
- The 2026-W27 baseline was backfilled from timestamped data; open
  issue/PR deltas are unavailable for it.

Generated by [Actions run 29207392116](https://github.com/ai-outfitter/.outfitter/actions/runs/29207392116).
