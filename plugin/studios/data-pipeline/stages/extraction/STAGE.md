---
name: extraction
description: Design and implement data extraction from sources
hats: [extractor, connector-reviewer, verifier]
fix_hats: [classifier, extractor, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: discovery
    discovery: source-catalog
---

# Extraction

Build the connectors that pull data from each source system into a staging area — faithfully, without loss, duplication, or surprise load on the source. This stage turns the discovery catalog into running extraction jobs.

## Scope

Implementing reliable, observable extraction into staging: incremental where the source supports it, full-load with a stated reason where it doesn't, with idempotency and retry built in from the first commit. Extraction decides *how data lands in staging intact* — it does not catalog sources (discovery), model the staged data (transformation), or test it (validation).

## What to do

- Honor the integration pattern discovery named for each source, or document why it had to change.
- Build idempotency, retry, and observability into every connector from the start, not as a later pass.
- Record each connector's operational shape — source, target staging, pattern, watermark, schedule, retry policy — alongside the code.
- Protect the source: extract incrementally and watermark wherever the source allows it.

## What NOT to do

- Don't re-profile or re-catalog sources — that was the discovery stage's job.
- Don't model, reshape, or apply business logic to the data — that's transformation.
- Don't author data-quality tests — that's validation.
- Don't ship a connector that can overload a production source on re-run.
