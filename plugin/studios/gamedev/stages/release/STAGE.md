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

Submit the polished build to storefronts and platform holders, pass platform certification, and stand up the post-launch patch pipeline. Platform-specific requirements vary widely — console certification programs are hard gates that can fail for reasons unrelated to the game's quality, mobile stores have their own review cycles, and digital storefronts each have their own submission cadence.

The patch pipeline matters as much as the initial submission. Games ship with bugs that QA didn't catch; the ability to ship a hotfix within days is what separates a launch disaster from a launch hiccup.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`release-engineer`** (plan + do) builds, packages, and submits to target storefronts and platform holders. Owns the submission pipeline, the patch pipeline, and the post-launch hotfix loop
- **`platform-cert-specialist`** (do-refine) walks each platform's certification checklist and preps the build to pass — every platform has its own requirements program (console first-party certification programs, mobile store review cycles, digital storefront submission policies)
- **`verifier`** (verify) validates each unit body for preconditions / action / post-condition completeness and rollback declaration

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The frontmatter declares `polish/game-build` as input. Release produces the `RELEASE` artifact: submitted builds across each named platform plus the live patch pipeline that survives launch.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, release-engineer, feedback-assessor]` dispatches per finding. Release-stage fixes are operational — re-cutting a submission build, re-running a certification pass, fixing the patch pipeline before launch day. The gate is `await` — release waits for the external event (platform certification result, storefront approval) rather than asking the user to approve locally. The submission has been made; the world responds.
