---
name: polish
description: Tuning, game feel, performance, bug triage, and juice
hats: [gameplay-engineer, tuner, performance-engineer, qa]
fix_hats: [classifier, gameplay-engineer, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: production
    output: game-build
---

# Polish

Tune game feel, fix bugs, optimize performance for target platforms, and integrate final audio and visual feedback (the "juice" that makes a hit register, a pickup feel satisfying, a transition land cleanly). Players cannot articulate the difference between a great game and a polished great game — but they feel it, and it's the difference between a 70 and an 85.

Polish is where you trade time for perceived quality. It's also where scope creep becomes fatal — new content added in polish rarely ships at quality and almost always pushes the release date.

## Per-unit baton

Each unit walks the four hats in `plan → do-tune → do-perf → verify` order:

- **`gameplay-engineer`** (plan + do-fix) fixes gameplay bugs and edge cases surfaced by playtests and QA — polish-phase engineering is reactive, not new construction
- **`tuner`** (do-feel) tunes game feel: timing, responsiveness, juice, pacing, difficulty curves. Numbers-and-feedback work; the gap between functional and great
- **`performance-engineer`** (do-perf) optimizes the game to meet platform performance targets — frame rate, load times, memory, thermal behavior on handhelds and mobile
- **`qa`** (verify) finds bugs and regressions before players do, validates fixes on the actual build, and certifies the unit is polish-complete

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The frontmatter declares `production/game-build` as input. Polish consumes the production build and produces a `POLISHED-BUILD` artifact that release stage submits to storefronts and certification.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, gameplay-engineer, feedback-assessor]` dispatches per finding. Polish-fix means re-tuning, re-fixing, or re-optimizing — never adding new content. The gate is `[external, ask]` — the user picks between external review (e.g., a publisher beta signoff, a platform pre-cert pass) or local approval.
