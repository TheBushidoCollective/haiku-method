---
name: production
description: Content and systems at scale
hats: [gameplay-engineer, content-author, systems-designer, reviewer]
fix_hats: [classifier, gameplay-engineer, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: concept
    discovery: concept-doc
  - stage: prototype
    output: prototype
---

# Production

Scale the validated prototype into the full game: build out content, implement systems at production quality, integrate art and audio, and deliver every beat the concept doc promised. Production is the longest stage of the gamedev lifecycle by a wide margin. **Scope discipline is the critical constraint** — the prototype defines what counts as "the game" and production's job is to scale that, not to invent new core mechanics.

New mechanics invented during production are scope creep. They get deferred to a sequel or DLC unless they are cheap and load-bearing for an existing pillar.

## Per-unit baton

Each unit walks the four hats in `plan → do-systems → do-content → verify` order:

- **`gameplay-engineer`** (plan + do-foundation) reimplements the validated core loop at production quality, building the systems content and design lean on
- **`systems-designer`** (do-tuning) tunes the interlocking systems — economies, progression curves, difficulty, meta-systems — at the math layer above individual mechanics
- **`content-author`** (do-content) builds the player-experienced content (levels, encounters, narrative beats, audio cues) against the systems, without engineer intervention for routine authoring
- **`reviewer`** (verify) reviews each unit against pillars and scope; production is the stage where scope creep shows up and the reviewer is the gatekeeper

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The frontmatter declares two inputs: `concept/concept-doc` (the pillars, fantasy, scope envelope production must hit) and `prototype/prototype` (the validated loop production must scale, plus the playtest evidence that justifies the scaling). Production's output is the `GAME-BUILD` artifact that polish consumes.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, gameplay-engineer, feedback-assessor]` dispatches per finding. The classifier routes the FB to the right unit; `gameplay-engineer` is the implementer (re-cutting the system or fixing the content's underlying scaffolding); the assessor decides closure. The gate is `[external, ask]` — the user picks between external review (e.g., a publisher milestone review at alpha or beta) or local approval.
