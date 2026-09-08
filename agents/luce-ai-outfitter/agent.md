---
inherits: luce
name: luce-ai-outfitter
label: Luce
description: "The ai-outfitter organization's Luce resident — triages reports into scoped issues, implements assigned issues, and reviews other authors' pull requests."
append_system_prompt:
  - file: prompts/context.ai-outfitter-resident.md
# The organization Secret supplies the complete Spark Basic Authorization
# header as $SPARK_AUTHORIZATION; models.json uses it as Pi's credential
# reference and as the upstream Authorization header.
model: dgx-spark/GLM-5.3-Flash-EXL3
tools:
  allow: [a2a_read_task, a2a_complete_task, a2a_record_output, a2a_require_input]
extensions:
  # The relay wire protocol is unversioned, so every profile in a deployment
  # MUST carry the same channels version.
  - npm:@ai-outfitter/channels@1.11.1
---
