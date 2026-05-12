---
name: extraction
description: Design and implement data extraction from sources
hats: [extractor, connector-reviewer]
fix_hats: [classifier, extractor, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: discovery
    discovery: source-catalog
---

# Extraction

Build the connectors that pull data from each source system into a staging
area without loss, duplication, or surprise load on the source. This stage
turns the discovery stage's source catalog into running extraction jobs:
incremental where the source supports it, full-load with reason where it
doesn't, with idempotency, retry, and observability baked in from the first
commit.

## Per-unit baton

Each extraction unit is one **source connector** (one source system, one
extraction pattern). The unit walks the two hats:

- **`extractor`** (do) implements the connector — incremental logic,
  watermarks, retry / backoff, schema-drift detection, dead-letter
  handling, and extraction metadata for auditability
- **`connector-reviewer`** (verify) reviews the connector for idempotency,
  partial-failure safety, and operational debugability — and either advances
  or rejects to the implementer

The plan role is implicit in the source-catalog input — discovery has already
named the integration pattern per source, so the extractor reads that
decision rather than re-planning it.

## Inputs and outputs

`SOURCE-CATALOG.md` from discovery is the contract. Each extraction unit
produces a connector implementation plus its row in `EXTRACTION-JOBS.md`
(intent-scope), which records the unit's source, target staging location,
extraction pattern, watermark column, schedule, and retry policy.

## Fix loop and gate

`fix_hats: [classifier, extractor, feedback-assessor]` dispatches per finding.
The gate is `ask` — a human reviews extraction logic before it lands in the
staging area, because re-running a misconfigured connector against a
production source is the easy way to overload it. Project overlays may add
team-specific connector templates, secrets-management conventions, or
warehouse-staging naming patterns without modifying plugin defaults.
