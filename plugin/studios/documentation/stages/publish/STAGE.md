---
name: publish
description: Format, validate links, and publish the documentation
hats: [publisher, verifier]
fix_hats: [classifier, publisher, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: draft
    discovery: draft-documentation
  - stage: review
    discovery: review-report
review-agents-include:
  - stage: draft
    agents: [accuracy]
---

# Publish

Take the reviewed draft and ship it to the docs platform — formatted to the platform's conventions, with every link, code block, image, and cross-reference verified. Publish is where invisible defects (broken links, malformed code fences, missing alt text, stale anchors) surface; catching them here is cheaper than catching them when a reader hits a 404.

## Per-unit baton

Each publish unit walks `publisher → verifier`:

- **`publisher`** (plan + do) reads the reviewed draft, adapts it to the docs platform's conventions (Markdown dialect, code-fence syntax, embed shapes), validates every link / image / cross-reference resolves, and pushes the artifact through the platform's publish surface
- **`verifier`** (verify) confirms the rendered output matches the draft's intent, every link still resolves at the published URL, navigation / sidebar updates landed, and search indexing is configured

Detailed process lives in each hat's md file. The `develop` stage's plan role is implicit upstream — this stage is mostly mechanical execution against an already-approved draft.

## Inputs and outputs

The frontmatter above declares the canonical I/O contract — upstream `draft/draft-documentation` and `review/review-report` feed in. This stage pulls in `draft/accuracy` as a review agent so accuracy concerns from the drafting stage stay attached during publish. The output is a published doc artifact at the platform's canonical URL plus a publish record (URL, version, search-indexed timestamp).

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, publisher, feedback-assessor]` dispatches per finding. The gate is `auto` — publishing is mechanical enough that the engine's spec gate plus the stage's `formatting` review agent suffice as the bar. Project overlays at `.haiku/studios/documentation/stages/publish/` may add team-specific docs platforms, named link checkers, or platform-specific embed conventions without modifying the plugin defaults.
