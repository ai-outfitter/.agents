# Org review personas

The ai-outfitter organization's shared **platform persona** for reviewing
Outfitter itself — its docs, onboarding, and CLI — from the point of view of a
target user. These are *review instruments*, not marketing: a persona is a
decision aid that produces structured, comparable feedback, not synthetic
validation that a surface is "good."

The docs here are plain **data**. The review *method* — the `reviewer` agent and
its `persona-review` skill — lives in its standard catalog location,
[`ai-outfitter/community-profiles`](https://github.com/ai-outfitter/community-profiles)
(`agents/reviewer/skills/persona-review/`). A review adopts one **role** then one
**individual** and returns a fixed 8-field shape so reviews from different
personas line up directly.

## Layout

```text
docs/personas/
  roles/
    platform-engineer.md      # kind: role — the customer segment's shared priorities
  individuals/
    theo-alvarez.md           # kind: individual — one named person, roles: [platform-engineer]
```

`platform-engineer` / `theo-alvarez` is a scrappier, friction-averse
counterpart to community-profiles' `platform-lead` / `priya-nair`, so the two
viewpoints triangulate: a lead at a ~150-engineer org who reads for the escape
hatch, versus the one platform person at a seed-stage startup who judges by
time-to-first-run and bails on setup friction.

## Field schema

- **role** (`kind: role`): `title`, `segment`, `goals`, `anxieties`,
  `buying_triggers`, `feedback_focus`, then one prose paragraph.
- **individual** (`kind: individual`): `name`, `roles` (existing role slug(s)),
  `born`, `location`, `household_income`, `education`, `employer`, `hobbies`,
  `skills`, `tone`, then one prose paragraph. An individual's `roles:` slug
  resolves to a `roles/<slug>.md` here.

## Running a review

Adopt these personas one-off with the `persona-review` skill's script (role
first, individual second). Run it from a project that sources community-profiles
so the `reviewer` agent resolves:

```bash
bash <community-profiles>/agents/reviewer/skills/persona-review/scripts/persona-review.sh \
  --persona docs/personas/roles/platform-engineer.md \
  --persona docs/personas/individuals/theo-alvarez.md \
  -- --print "Return the standard persona-review shape. @<outfitter>/docs/documentation/getting-started.md"
```

That expands to `outfitter run reviewer -- --append-system-prompt <role>
--append-system-prompt <individual> --print "…"`. Put the `@artifact` path
**last** in the `--print` prompt — pi reads an `@` reference to the end of the
string, so the instruction must come before it. Run once per artifact and
compare the fixed-shape outputs (Persona · Artifact reviewed · First impression ·
Top blocker · Strongest value signal · Confusing language · Suggested change ·
Confidence) side by side.
