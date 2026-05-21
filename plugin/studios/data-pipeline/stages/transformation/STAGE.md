---
name: transformation
description: Transform and model data for the target schema
hats: [transformer, data-modeler, verifier]
fix_hats: [classifier, transformer, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: extraction
    discovery: staged-data
---

# Transformation

Convert raw staged data into the modeled, queryable shape the analytical consumers actually need. This stage owns the target data model and the code that materializes it — it's where the pipeline's business meaning is encoded.

## Scope

Defining the target model — grain, surrogate keys, SCD strategy, business-rule encoding — and writing the transformation code that produces it. Transformation decides *what the modeled data is and how it's computed* — it does not extract data into staging (extraction) or test the result (validation).

## What to do

- Define each model's grain, columns, surrogate key, SCD type, and primary query access patterns before writing transformation code.
- Materialize models from staged sources with idempotency and explicit type handling.
- Keep all business logic inside the models; logic that leaks elsewhere is drift downstream reviewers will hunt for.
- Favor named intermediate steps over deep subquery nesting so the model stays legible.

## What NOT to do

- Don't build or re-run extraction connectors — that's the extraction stage.
- Don't write the data-quality test suite — that's validation.
- Don't reshape the source profile discovery established; if it's wrong, that's a revisit upstream.
- Don't scatter business rules outside the model where consumers can't find or trust them.
