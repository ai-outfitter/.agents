# SDLC workflows

Adopted from the [ai-outfitter/link](https://github.com/ai-outfitter/link)
SDLC reference collection, pinned at `ai-outfitter/link@23f8d97`.

- `workflows/` — `agent-workflow/v1` definitions. Same-id layer precedence:
  edit the data here (reviewer team, backend enum, trigger) — keep the ids.
- `spec/` — the meta-schemas the workflows validate against, carried beside
  them so the relative `$ref`s resolve.
- `governance/sdlc-baseline.yaml` — the conformance baseline the workflows
  `require`; `link report` audits this org against it.
- `bin/rank-implementers` — the decision step behind `runs-on:` routing.

Status: authoring surface only. Validated against `spec/` in CI where this
catalog has CI; no runtime executes these yet. To take upstream template
improvements, diff against link at a newer pin and review the changes —
propagation is by review, not resolution.
