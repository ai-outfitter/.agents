# Outfitter-bot deployment and loop-readiness eval

**Evaluated:** 2026-08-08

**Subject:** [`outfitter-bot`](../../agents/outfitter-bot/agent.md) resident agent

**Verdict:** The agent is deployed and Ready, with its A2A channel running. The feature-request issue-to-PR loop is not yet runnable because its forge identity has not been bootstrapped.

## Evidence

| Evidence | Observation | Result |
| --- | --- | --- |
| Live deployment observation, 2026-08-08 | The agent was deployed to a Kubernetes cluster in its own `ai-outfitter` Organization and dedicated namespace. Its condition reached `Ready=True`. | Deployment succeeded. |
| Live catalog-resolution observation, 2026-08-08 | The operator resolved this public catalog anonymously; catalog resolution required no credential. | Public deployment path succeeded. |
| [Pinned profile](../../agents/outfitter-bot/agent.md) plus live startup observation | The profile pins channels v1.6.1 by release commit `03fb6d22769fb31f1d4f5241b109502f5ab9a848`. That extension installed, and the agent channel started. | The A2A task plane loaded. |
| [Same-day fix `1d19e5a`](https://github.com/ai-outfitter/.agents/commit/1d19e5ab15c1e8c396e94485610abb474d13c7df) and strict validation | The original description contained an unquoted colon, so the live runtime could not parse the YAML frontmatter. The in-cluster bring-up caught a defect that the lane's review gates had missed. The description was quoted, and `outfitter validate --strict` was run on the tree. The YAML error is gone; the command currently exits nonzero only because strict mode promotes five existing source-shadowing warnings to failures. | Runtime defect fixed the same day. |
| Identity check plus [governance baseline](../../governance/sdlc-baseline.yaml) | No `outfitter-bot` forge identity exists yet. The remaining bootstrap step is a GitHub machine account with a classic PAT because the notifications endpoint rejects fine-grained tokens. Governance already limits the identity to `open-pr`, `comment`, and `request-review`, and forbids `merge` and `push-protected`. | Issue-to-PR execution remains blocked on identity only. |

The deployment observations above were recorded during bring-up, but no session capture was retained. They are therefore operator-observed evidence rather than replayable artifacts. Repository evidence is durable in the linked profile, governance policy, and fix commit.

## Verdicts

| Capability | Verdict | Basis |
| --- | --- | --- |
| Deployed | **Pass** | `Ready=True` in the dedicated deployment namespace. |
| Catalog resolution from public repository | **Pass — anonymous** | Operator-side resolution used no catalog credential. |
| A2A channels loaded | **Pass** | Pinned channels v1.6.1 installed; agent channel started. |
| Issue → PR loop | **Blocked — identity** | GitHub machine account and classic PAT do not yet exist. |
| Session capture | **Absent** | No replayable bring-up session was retained. |

**Next action:** create the governed `outfitter-bot` forge identity, then exercise one assigned or labeled feature request through PR creation without expanding its declared capability caps.
