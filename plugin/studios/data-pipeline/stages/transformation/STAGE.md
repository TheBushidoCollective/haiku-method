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

Convert raw staged data into the modeled, queryable shape the analytical
consumers actually need. This stage owns the target data model — grain
definitions, surrogate keys, SCD strategy, business-rule encoding — and the
transformation code that produces it. Business logic that lives anywhere
other than this stage's models is leakage; reviewers downstream will hunt
for it and find drift.

## Per-unit baton

Each transformation unit is one **target model** (one entity, one grain).
The unit walks the three hats in `plan → do → verify` order:

- **`data-modeler`** (plan) defines the model — grain, columns, surrogate
  key, SCD type per dimension, primary-query access patterns — and writes
  the model spec
- **`transformer`** (do) writes the transformation code that materializes
  the model from staged sources, with idempotency, explicit type handling,
  and named intermediate steps over deep subquery nesting
- **`verifier`** (verify) validates the artifact body-only against substance,
  citation, internal consistency, and decision-register accountability

Note: the `hats:` order above is `transformer, data-modeler, verifier`, which
historically grew do-first. The model spec written by the data-modeler is
the load-bearing input to the transformer; treat data-modeler as the plan
role conceptually even though the file order doesn't reflect it. A future
revision may swap them.

## Inputs and outputs

Staged data from extraction is the input. The stage produces `DATA-MODEL.md`
(intent-scope) — the catalog of every target entity, its grain, columns,
relationships, and SCD strategy — plus the transformation code that
populates them.

## Fix loop and gate

`fix_hats: [classifier, transformer, feedback-assessor]` dispatches per
finding. The gate is `ask` — a human signs off on the data model and
transformation logic before validation tests run against them, because the
model shape is hard to change once analytical consumers depend on it.
Project overlays may add house-style modeling conventions (naming, layer
folders, SCD-type defaults) without modifying plugin defaults.
