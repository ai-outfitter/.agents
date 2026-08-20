# Changelog

## 1.0.0 (2026-08-20)


### ⚠ BREAKING CHANGES

* weekly KPI reports and the github-actions profile now live in ai-outfitter/wiki; consumers sourcing this repo for the reports skill should point at the wiki repo's .agents payload instead.

### Features

* activity section links releases and lists their changelog bullets ([ce24c70](https://github.com/ai-outfitter/.agents/commit/ce24c70355fc2f024a547cd721f6be68e987b955))
* add the outfitter-bot resident agent profile ([#5](https://github.com/ai-outfitter/.agents/issues/5)) ([b3e2bb1](https://github.com/ai-outfitter/.agents/commit/b3e2bb1caab162003718f1c6daf842a972193a03))
* adopt sdlc reference workflows from link ([#4](https://github.com/ai-outfitter/.agents/issues/4)) ([6cc26f9](https://github.com/ai-outfitter/.agents/commit/6cc26f9106f4890adb49fe5c48b8aa79e566492b))
* define the OpenAI provider for the whole organization ([#9](https://github.com/ai-outfitter/.agents/issues/9)) ([be7bbef](https://github.com/ai-outfitter/.agents/commit/be7bbefe570e6c4be5399e022cf573eb1f66d416))
* luce resolves from community-profiles v1.4.0 ([#24](https://github.com/ai-outfitter/.agents/issues/24)) ([1145b15](https://github.com/ai-outfitter/.agents/commit/1145b15c06a22e12de79e7ecb7638f4b2100559d))
* **luce:** formal pull-request reviews with line-anchored findings ([#21](https://github.com/ai-outfitter/.agents/issues/21)) ([da353cd](https://github.com/ai-outfitter/.agents/commit/da353cd293e7dc2d7eb06cabf7e0272e790208f0))
* **luce:** implement assigned issues, and deploy on merge ([#13](https://github.com/ai-outfitter/.agents/issues/13)) ([7cf1654](https://github.com/ai-outfitter/.agents/commit/7cf16542558837d7fd0776a05dec4aa2e0298599))
* one agent-credentials Secret per agent namespace ([#16](https://github.com/ai-outfitter/.agents/issues/16)) ([c20bee6](https://github.com/ai-outfitter/.agents/commit/c20bee6fbf51a5823dec3579dd9eb9c5dc3f4a1e))
* org catalog with outfitter-developer profile and weekly KPI reporting ([f5271bc](https://github.com/ai-outfitter/.agents/commit/f5271bcdfa4681e7d89a1eba86053d6d1e4f0532))
* org-scoped deployments for Luce, Vega, and outfitter-bot ([#28](https://github.com/ai-outfitter/.agents/issues/28)) ([8b8cf20](https://github.com/ai-outfitter/.agents/commit/8b8cf206a105d3bab8e45a3d91bf546dfcb2390b))
* refocus as the org .agents repo ([47154e8](https://github.com/ai-outfitter/.agents/commit/47154e822427f96fd00542a16342008535252267))
* release-please cuts catalog version tags ([#22](https://github.com/ai-outfitter/.agents/issues/22)) ([08e5a58](https://github.com/ai-outfitter/.agents/commit/08e5a589b981d49519db266ace8a697daf90e158))
* reports link to the Actions run that generated them ([f53ed49](https://github.com/ai-outfitter/.agents/commit/f53ed496fd99c79617021984d73925cacb7f176c))
* weekly status report — per-week folders, JSON state, backfill, deterministic rendering ([a294fe2](https://github.com/ai-outfitter/.agents/commit/a294fe2f9199d8f4014a829b0e0c3389e1c04eaa))


### Bug Fixes

* back to gpt-4.1-mini — full gpt-4.1 caps requests at 8000 tokens on the free tier ([87622bf](https://github.com/ai-outfitter/.agents/commit/87622bfd27600ed42f856aeadeda4cef9a5a77f8))
* backfill never clobbers an existing snapshot; restore correct W27 baseline ([6d0d542](https://github.com/ai-outfitter/.agents/commit/6d0d5421f874696ed66cccda2d4a07ff02a1684b))
* batch all KPI gathering into one script — pi's per-tool-call requests hit the 15/min model rate limit ([28e2b48](https://github.com/ai-outfitter/.agents/commit/28e2b48f866c2071e4f4e79eb134e3b5f2f077a4))
* cap tool output size — the legacy endpoint rejects &gt;8000-token request bodies ([fe14f77](https://github.com/ai-outfitter/.agents/commit/fe14f77fec8542ce22152d96cbf3defa921f6b3b))
* collector prints expanded run_url and generated_at — agent copies values verbatim ([f5b46a9](https://github.com/ai-outfitter/.agents/commit/f5b46a9a057163d21fad28cc0e138bea6bf3fb11))
* drop default-profiles, pin community-profiles v1.2.1 ([#10](https://github.com/ai-outfitter/.agents/issues/10)) ([903172c](https://github.com/ai-outfitter/.agents/commit/903172cfba03f4b404efa7cf75b43f08136803bd))
* force non-interactive completion in the task prompt; upgrade to gpt-4.1 ([2e64302](https://github.com/ai-outfitter/.agents/commit/2e64302d23c6351ca3ff546fb64ff9777cb25400))
* hand the skill an exact gathering script; pin the deliverable path in the prompt ([86e08ed](https://github.com/ai-outfitter/.agents/commit/86e08edf4d928a278947fe847876ae93524813a5))
* **luce:** formal reviews over the stdio bridge on 1.5.0 runtimes ([#26](https://github.com/ai-outfitter/.agents/issues/26)) ([495e07d](https://github.com/ai-outfitter/.agents/commit/495e07db89443fbf2d6ae34c6e4d81f8d28a5785))
* **luce:** select the openai provider model ([#15](https://github.com/ai-outfitter/.agents/issues/15)) ([3e7af15](https://github.com/ai-outfitter/.agents/commit/3e7af157260a17d981393192e81d133a74e4c810))
* make reading the reports skill the prompt's mandatory first step ([653fd7c](https://github.com/ai-outfitter/.agents/commit/653fd7c8234a5921d92462d2d4e64013f9aeea85))
* **outfitter-bot:** enable pull request creation ([#8](https://github.com/ai-outfitter/.agents/issues/8)) ([3c137f9](https://github.com/ai-outfitter/.agents/commit/3c137f9b6a9d90daa96815495d44bad7f5a24342))
* pace tool calls with sleep prefix — pi dies on 429 instead of backing off ([aecd6dd](https://github.com/ai-outfitter/.agents/commit/aecd6dd1f6f5fdfab370794301240a62d3231363))
* quote the outfitter-bot description — unquoted colon broke YAML parsing ([1d19e5a](https://github.com/ai-outfitter/.agents/commit/1d19e5ab15c1e8c396e94485610abb474d13c7df))
* resolve the skill's own directory before using its scripts and assets ([981e99b](https://github.com/ai-outfitter/.agents/commit/981e99bd93804d82836255c968da374db1954d67))
* restore the direct luce profile for Outfitter 1.5.0 runtimes ([#25](https://github.com/ai-outfitter/.agents/issues/25)) ([ba5db38](https://github.com/ai-outfitter/.agents/commit/ba5db38d0d553a4728473d674451f3b492324e75))
* run inference on the legacy GitHub Models endpoint via the workflow token ([c03ca73](https://github.com/ai-outfitter/.agents/commit/c03ca73c01f91a8558a16899c8cbf010005c3453))
* run KPI workflow on GitHub Models with absolute profile-source path ([7bd601c](https://github.com/ai-outfitter/.agents/commit/7bd601c275cc806b7ada98464cfd08c83a256e50))
* stargazer/fork backfill pagination — use --paginate --slurp piped to jq ([a3f88e1](https://github.com/ai-outfitter/.agents/commit/a3f88e18f09fdc6a40d0bdedc795942704ececc5))
* switch inference to Anthropic; GitHub Models is unavailable in this enterprise ([15526f4](https://github.com/ai-outfitter/.agents/commit/15526f40e504d85eb9d9657f0491d4649de54484))
* tell the profile it runs headless — complete the skill, never ask for confirmation ([ad768d9](https://github.com/ai-outfitter/.agents/commit/ad768d9b350cfca973fcd82278317094b76340e6))
