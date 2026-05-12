---
name: concept
description: Pillars, core loop, fantasy, target audience, and scope
hats: [game-designer, creative-director, distiller, verifier]
fix_hats: [classifier, game-designer, feedback-assessor]
review: ask
elaboration: collaborative
inputs: []
---

# Concept

Define what the game *is*: design pillars (3-5 core promises the game makes to the player), core loop (what the player does minute-to-minute), fantasy (what the player feels like while playing), target audience, and scope (content volume, target platforms, budget envelope).

Concept absorbs traditional discovery. Unlike application development, there is no separate inception stage — game concepts are inseparable from market fit and creative vision. The design doc *is* the discovery document.

## Per-unit baton

Each unit walks the four hats in `plan → plan-refine → do → verify` order:

- **`game-designer`** (plan) drafts mechanics, the core loop's shape, and how each pillar maps to player-facing verbs
- **`creative-director`** (plan-refine) reconciles the design's mechanical proposal with art, audio, and narrative direction; arbitrates when they conflict
- **`distiller`** (do) turns the agreed direction into the per-topic knowledge artifact (pillars doc, core-loop doc, fantasy doc, etc.) that downstream stages will read as input
- **`verifier`** (verify) validates the artifact for substance, coherence, and decision-register consistency, then advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

This is the first stage of the gamedev lifecycle, so `inputs: []` is intentional. Concept's outputs are the per-topic knowledge artifacts that every downstream stage reads — `prototype` builds against the core-loop doc, `production` scales against the pillars and scope, `polish` tunes against the fantasy and audience, `release` packages for the platforms named in scope.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, game-designer, feedback-assessor]` dispatches per finding. The classifier routes the FB to the topic unit it targets; `game-designer` is the implementer (re-authoring the pillar / loop / fantasy / scope where the finding belongs); the assessor independently decides closure. The gate is `ask` — concept is a creative-direction decision that needs a human signoff inside the review UI, not an external system.
