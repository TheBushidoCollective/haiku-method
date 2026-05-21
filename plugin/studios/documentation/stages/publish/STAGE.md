---
name: publish
description: Format, validate links, and publish the documentation
hats: [format-planner, publisher, verifier]
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

The terminal stage of the documentation lifecycle: ship the reviewed draft to the docs platform, formatted to its conventions, with every link, code block, image, and cross-reference verified. This is where the invisible defects surface — broken links, malformed fences, missing alt text, stale anchors — and catching them here is cheaper than catching them at a reader's 404.

## Scope

Formatting to the platform, verifying every embedded reference, and recording the publish. Publish decides *how the content goes live and that it's intact on the platform* — it does not write or edit content (draft, review). Content defects route back upstream; this stage owns the mechanics of shipping.

## What to do

- Format the content to the platform's conventions — embed shapes, anchors, asset destinations.
- Verify every link, code block, image, and cross-reference actually resolves.
- Record the publish: canonical URL, version, and search-indexed timestamp.
- Route a content or accuracy defect back to the stage that owns it rather than patching prose here.

## What NOT to do

- Don't rewrite prose or restructure content — that's the draft and review stages.
- Don't re-litigate editorial or technical findings — they were resolved upstream.
- Don't publish with a broken link, a malformed code block, or a missing asset.
- Don't ship without a recorded publish artifact at the canonical URL.
