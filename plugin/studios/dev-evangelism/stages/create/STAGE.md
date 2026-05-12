---
name: create
description: Produce the content — posts, slides, demos, videos
hats: [content-creator, demo-builder, verifier]
fix_hats: [classifier, content-creator, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: narrative
    discovery: story-arc
outputs:
  - discovery: content-package
    hat: content-creator
---

# Create

Create is the build / execution stage of the dev-evangelism lifecycle. It takes the narrative brief and turns it into the actual content assets — written posts, talk decks, demo projects, video scripts. This is where abstract messaging becomes concrete artifacts that developers can read, watch, and run.

Each unit here covers one asset family (one blog post, one talk, one demo project, one video). The stage's two production hats split along a real boundary: the content-creator owns the prose / slide / script asset itself; the demo-builder owns any runnable code or live demo that the asset references or depends on.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`content-creator`** (plan / do for the asset) reads the narrative brief and authors the written / spoken / scripted asset for this unit — copy, structure, calls-to-action, format-specific shaping
- **`demo-builder`** (do for runnable proof) builds any code / live demo the content references — working, reproducible from a clean environment, with documented setup
- **`verifier`** (verify) validates the asset+demo pair against substance / runnability / consistency rules and advances or rejects to the responsible hat

The baton: narrative brief → asset draft (content-creator) → asset + working demo (demo-builder) → validated asset (verifier).

## Inputs and outputs

Upstream `narrative/story-arc` feeds in. The output is the intent-scope `CONTENT-PACKAGE.md` enumerating every produced asset (with its runnable demo, if any) and confirming each asset hits the narrative's takeaways.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, content-creator, feedback-assessor]` dispatches per finding. The gate is `ask` — content correctness and tone are the highest-stakes decision before public distribution, so a human reviews before publish kicks off.
