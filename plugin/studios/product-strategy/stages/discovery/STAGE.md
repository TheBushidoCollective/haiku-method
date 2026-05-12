---
name: discovery
description: Explore market landscape, competitive positioning, and opportunity space
hats: [market-explorer, competitive-analyst, verifier]
fix_hats: [classifier, market-explorer, feedback-assessor]
review: auto
elaboration: autonomous
inputs: []
---

# Discovery

Map the territory before anything else. Where does the market sit today, who occupies it, where is it moving, and which corners of it are underserved enough to matter? This is a research / distillation stage — every unit is a knowledge topic the downstream stages will lean on.

## Per-unit baton

Each discovery unit walks the three hats in `plan → do → verify` order:

- **`market-explorer`** (plan / breadth) surveys segments, trends, adjacencies, and emerging shifts for the unit's topic. Produces the raw landscape view.
- **`competitive-analyst`** (do / depth) takes the landscape and turns it into positioning maps, competitor trajectories, and a named opportunity space.
- **`verifier`** (verify) validates the artifact's substance, citation chain, and internal consistency, then advances or rejects with a named criterion.

Detailed process lives in each hat's md file — this stage enforces the chain.

## Inputs and outputs

No upstream stage feeds this stage; it bootstraps the lifecycle. Each unit produces a knowledge artifact at `discovery/MARKET-LANDSCAPE.md` (or its per-topic equivalent) that `user-research` and `prioritization` consume.

## Fix loop and gate

`fix_hats: [classifier, market-explorer, feedback-assessor]` dispatches per finding — the classifier targets the right unit, the market-explorer re-authors the affected slice, the assessor independently decides closure. The gate is `auto` because no human decision is required to advance into `user-research`; the downstream stage's elaboration loop is where the user re-engages. Project overlays at `.haiku/studios/product-strategy/stages/discovery/` may add team-specific source lists, market-sizing conventions, or research-repository links without touching the plugin defaults.
