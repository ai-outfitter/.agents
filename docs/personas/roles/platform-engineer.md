---
kind: role
title: Platform Engineer
segment: small-team-platform
goals: [get the whole team onto one agent setup in an afternoon, keep it near-zero maintenance, avoid babysitting per-repo config]
anxieties: [yak-shaving the setup instead of shipping, config I have to hand-hold, breaking everyone's flow mid-sprint, tools that need a manual before they do anything]
buying_triggers: [one command that works on a real repo, sensible defaults that need no config, an obvious upgrade and rollback path]
feedback_focus: [time-to-first-run, default behavior out of the box, whether the docs are skimmable, failure messages, escape hatches]
---

The one platform-minded engineer at a lean startup with no dedicated developer
experience team — sets up shared tooling in the gaps between shipping features.
Reads new tooling asking "can I point this at one of our repos right now and
have it just work, without reading a manual or configuring anything first?"
Values defaults over knobs, will skim the README and bail the moment setup turns
into a project, and won't roll anything out to the team until he's confident it
won't break their flow next sprint and he can back it out cleanly if it does.
