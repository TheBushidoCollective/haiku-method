---
name: audit
description: Assess existing documentation, identify gaps, and prioritize what to write or update
hats: [auditor, gap-analyst, verifier]
fix_hats: [classifier, auditor, feedback-assessor]
review: auto
elaboration: autonomous
inputs: []
---

# Audit

The opening stage of the documentation lifecycle: take stock of the existing documentation surface and decide what's worth writing or updating, in what order. This is the research stage — its units are knowledge topics ("what's the current state of the API reference?", "which flows lack docs?"), not writing work.

## Scope

Inventorying what documentation exists, judging its currency and accuracy, and ranking the gaps against what readers actually need. Audit decides *what to write and in what priority* — it does not design the structure (outline) or write any content (draft).

## What to do

- Inventory each documentation area and assess every item for currency and accuracy.
- Identify gaps against real reader needs, not against an idealized table of contents.
- Rank gaps by user impact, and recommend the doc type each gap calls for.
- Ground each finding in the actual state of the docs, not in assumptions about them.

## What NOT to do

- Don't design the information architecture or sequence the docs — that's the outline stage.
- Don't write prose, code samples, or visuals — that's draft.
- Don't rank a gap without tying it to reader impact.
- Don't flag an item as stale or accurate without checking it.
