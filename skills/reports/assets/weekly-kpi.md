---
week: {{YYYY}}-W{{WW}}
status: {{draft|final}}
generated_at: {{ISO-8601 UTC timestamp}}
---

# ai-outfitter weekly KPIs — {{YYYY}}-W{{WW}}

Week of {{monday}} to {{sunday}}. {{Draft — finalized by the Sunday scheduled
run. | Final.}}

## Org totals

| Metric | Value | Δ vs {{previous week}} |
| --- | ---: | ---: |
| Stars | {{n}} | {{±n or —}} |
| Forks | {{n}} | {{±n or —}} |
| Open issues | {{n}} | {{±n or —}} |
| Open pull requests | {{n}} | {{±n or —}} |
| Commits this week (default branches) | {{n}} | {{±n or —}} |

## Per-repository

| Repository | Stars | Forks | Open issues | Open PRs | Commits this week |
| --- | ---: | ---: | ---: | ---: | ---: |
| {{repo}} | {{n}} | {{n}} | {{n}} | {{n}} | {{n}} |

Notes:

- Traffic (views/clones) omitted: requires push access per repository from
  the run's token.
- Commit counts cover each repository's default branch since Monday 00:00 UTC.
- Private org repositories other than the one this workflow runs in are not
  visible to the workflow token and are excluded.
