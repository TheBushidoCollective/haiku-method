---
name: draft
description: Write the documentation content following the approved outline
hats: [writer, technical-reviewer, verifier]
fix_hats: [classifier, writer, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: outline
    discovery: document-outline
---

# Draft

The build stage of the documentation lifecycle: turn the approved outline into the actual content readers will see — prose, code samples, and visuals, technically verified against the source of truth.

## Scope

Writing each outlined section into accurate, complete content with working examples. Draft decides *what the documentation actually says* — it does not design the structure (outline) or do the editorial and polish pass (review). It fills the outline; it doesn't redesign it.

## What to do

- Write each section to the outline's purpose and doc mode, filling the structure rather than reshaping it.
- Cite the source of truth for every technical claim and example.
- Write code samples that actually run and visuals that actually clarify.
- Confirm technical claims against reality before handing the draft on.

## What NOT to do

- Don't restructure or re-sequence the IA — a wrong outline is a revisit upstream, not a quiet rewrite here.
- Don't do the editorial polish or final consistency pass — that's the review stage.
- Don't ship a code sample you haven't verified runs.
- Don't add sections the outline didn't scope.
