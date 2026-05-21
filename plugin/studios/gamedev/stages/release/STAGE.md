---
name: release
description: Storefront submission, platform certification, and patch pipeline
hats: [release-engineer, platform-cert-specialist, verifier]
fix_hats: [classifier, release-engineer, feedback-assessor]
review: await
elaboration: autonomous
inputs:
  - stage: polish
    output: game-build
---

# Release

The terminal stage of the gamedev lifecycle: get the polished build into players' hands and keep it healthy. Submit to storefronts and platform holders, pass platform certification, and stand up the post-launch patch pipeline. This stage ships and sustains the game; it does not change it.

## Scope

Shipping and sustaining the build: storefront submission, platform certification, and the patch/hotfix pipeline that survives launch. Release decides *how the finished game reaches and stays live for players* — not its content (production) or its feel (polish). Platform requirements vary widely and many are hard gates outside the team's control.

## What to do

- Build, package, and submit to each target storefront and platform holder on its own submission cadence.
- Walk every platform's certification checklist and prep the build to pass it — cert can fail for reasons unrelated to game quality.
- Stand up the patch pipeline so a hotfix can ship within days; that's what separates a launch hiccup from a launch disaster.
- Treat fixes here as operational — re-cutting a submission build or re-running a cert pass, not reworking the game.

## What NOT to do

- Don't change gameplay, content, or feel to clear certification — a quality problem is a revisit to polish, not a patch jammed into submission.
- Don't treat the initial submission as the finish line and skip the patch pipeline.
- Don't assume one platform's cert outcome generalizes to the others.
- Don't ship without a working path to push a post-launch fix.
