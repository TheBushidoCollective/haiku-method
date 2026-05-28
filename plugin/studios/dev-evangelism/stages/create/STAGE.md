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

The build stage of the dev-evangelism lifecycle: turn the narrative brief into the actual content assets — written posts, talk decks, demo projects, video scripts. This is where abstract messaging becomes concrete artifacts developers can read, watch, and run.

## Scope

Producing the assets the narrative scoped, with any runnable code the content depends on owned alongside the asset. Create decides *how the story becomes concrete artifacts* — it does not redefine the story (narrative) or distribute the result (publish). Each unit covers one asset family — a post, a talk, a demo project, a video.

## What to do

- Author each asset to the narrative brief's arc and takeaways — copy, structure, calls-to-action shaped to the format.
- Build any code or live demo the content references so it's working and reproducible from a clean environment, with documented setup.
- Keep every published claim backed by proof the reader can run or inspect.
- Confirm each asset actually hits the takeaways the narrative defined.

## What NOT to do

- Don't reshape the story arc or messaging — a wrong narrative is a revisit upstream, not a quiet rewrite here.
- Don't distribute, cross-post, or seed communities — that's the publish stage.
- Don't ship a demo that only runs on your machine.
- Don't add assets the narrative didn't scope.
