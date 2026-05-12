---
name: narrative
description: Craft story arcs, key messages, and takeaways
hats: [storyteller, editor, verifier]
fix_hats: [classifier, storyteller, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: research
    discovery: audience-landscape
outputs:
  - discovery: story-arc
    hat: storyteller
---

# Narrative

Narrative is the design / synthesis stage of the dev-evangelism lifecycle. It takes the research stage's audience landscape and turns it into a story — the problem-solution-outcome arc, the hook, the small set of takeaways the audience should leave with, and the audience-to-message mapping that every downstream creator will execute against.

Narrative does NOT produce content assets. It produces the contract that the create stage executes against. A weak narrative produces beautiful content nobody reads; a strong narrative survives translation into multiple formats without losing its point.

## Per-unit baton

Units here are **story components** (the hook, the central conflict, the resolution, per-segment messaging). Each unit walks the three hats in `plan → do → verify` order:

- **`storyteller`** (plan / do for the arc) reads the audience landscape and drafts the arc, hook, and 3-or-fewer takeaways for this story slice
- **`editor`** (do for clarity / fit) refines the arc — strips jargon that excludes target segments, tightens tone to match the audience's actual reading patterns, and flags any technical claim that needs a demo or code proof to be credible
- **`verifier`** (verify) validates the resulting story artifact against substance / citation / consistency rules and advances or rejects to the responsible hat

The baton is the story arc evolving from skeleton (storyteller) to polished, audience-fit, and demo-flagged (editor) to validated (verifier).

## Inputs and outputs

Upstream `research/audience-landscape` feeds in. The output is the intent-scope `NARRATIVE-BRIEF.md` containing the arc, takeaways, audience-to-message mapping, and editorial guidance for the create stage.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, storyteller, feedback-assessor]` dispatches per finding. The gate is `ask` — the narrative is the last load-bearing decision before content production starts, so a human reviews the arc and takeaways before the create stage spins up.
