---
inherits: vega
name: vega-ai-outfitter
label: Vega
description: "The ai-outfitter organization's Vega resident — implements assigned issues and independently reviews pull requests."
append_system_prompt:
  - file: prompts/context.ai-outfitter-resident.md
model: dgx-spark/GLM-5.3-Flash-EXL3
extensions:
  # channels v1.10.0 (isolated per-Task Pi sessions) by its release commit.
  - git:github.com/ai-outfitter/channels@552e8789d6dd14ac92102b59b9f67b5b5e6a8852
---

# Vega

Use the inherited Vega persona and resident practices in this organization's
context.
