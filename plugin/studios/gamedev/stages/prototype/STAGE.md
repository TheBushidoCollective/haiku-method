---
name: prototype
description: Playable vertical slice that proves the fun before production
hats: [prototype-engineer, game-designer, playtester, verifier]
fix_hats: [classifier, prototype-engineer, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: concept
    discovery: concept-doc
---

# Prototype

Build the smallest playable thing that can validate whether the core loop is actually fun. This is a hard gate before production — if the prototype isn't fun, committing production resources to it is wasted work. Playtesting with players outside the team is mandatory; the team always thinks their prototype is fun.

The prototype is not meant to scale, look good, or be maintainable. It is meant to answer one question: does this work?

## Per-unit baton

Each unit walks the four hats in `plan → do → playtest → verify` order:

- **`prototype-engineer`** (plan + do) builds the slice — the smallest runnable artifact that exercises the unit's piece of the core loop. Disposable code; speed over architecture
- **`game-designer`** (do-refine) watches playtests and adjusts the design — not defending the concept doc, changing the loop where data says it isn't landing
- **`playtester`** (do-validate) runs sessions with players outside the team and records what they actually do, not just what they say
- **`verifier`** (verify) validates the unit body against the prototype's success criteria and either advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The frontmatter declares `concept/concept-doc` as input. The prototype consumes the core-loop spec, pillars, and fantasy from concept and produces a `PROTOTYPE` artifact (playable build + recorded playtest sessions) that production reads as input.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, prototype-engineer, feedback-assessor]` dispatches per finding. The classifier routes the FB; `prototype-engineer` re-cuts the slice where the finding lands; the assessor decides closure. The gate is `[external, ask]` — the user picks between an external review (e.g., a publisher milestone review on the playable build) or local approval inside the review UI.
