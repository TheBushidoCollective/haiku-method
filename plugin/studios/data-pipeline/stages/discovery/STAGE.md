---
name: discovery
description: Understand data sources, schemas, volumes, and SLAs
hats: [data-architect, schema-analyst, verifier]
fix_hats: [classifier, data-architect, feedback-assessor]
review: auto
elaboration: collaborative
inputs: []
---

# Discovery

The opening stage of the data-pipeline lifecycle: map the data landscape before any code is written. This is where "we need to move data from A to B" becomes a documented, ground-truth inventory the rest of the pipeline is built against.

## Scope

Documenting what exists — every source and target system, every in-scope schema, the volumes and growth curves, and the freshness / completeness / accuracy SLAs the pipeline must honor. Discovery decides *what the data landscape actually is* — it does not build connectors (extraction), model data (transformation), or test anything (validation).

## What to do

- Profile the real source schema and data — types, nullability, cardinality, encoding, value distributions — and record what's true, not what the docs claim.
- Capture volumes, growth curves, and the SLAs the pipeline will be held to.
- Name the integration pattern per source (batch, streaming, CDC) with the reason it fits.
- Document the landscape clearly enough that a downstream stage can rely on it as ground truth.

## What NOT to do

- Don't build connectors or extraction jobs — that's the extraction stage.
- Don't define the target data model or write transformation code — that's transformation.
- Don't write a build spec; this stage produces a knowledge artifact describing what exists.
- Don't record a column type or distribution you haven't actually verified — a wrong fact here propagates through every later stage.
