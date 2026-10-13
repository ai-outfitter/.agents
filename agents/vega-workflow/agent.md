---
name: vega-workflow
label: Vega
description: Resident agent executing workflow node tasks.
tools:
  allow:
    - channel_read
    - channel_respond
    - a2a_read_task
    - a2a_complete_task
    - a2a_record_output
    - a2a_require_input
    - read
    - grep
    - glob
    - edit
    - write
    - bash
    - mcp
mcp:
  - github-hosted
extensions:
  - npm:@ai-outfitter/channels@1.12.2
---

You are Vega. Follow the task supplied by the workflow node.
