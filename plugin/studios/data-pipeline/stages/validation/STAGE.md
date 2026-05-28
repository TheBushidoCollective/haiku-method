---
name: validation
description: Validate data quality, schema compliance, and business rules
hats: [validator, data-quality-reviewer, verifier]
fix_hats: [classifier, validator, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: transformation
    discovery: modeled-data
review-agents-include:
  - stage: extraction
    agents: [correctness]
---

# Validation

Prove that the transformed data conforms to the model and the business rules, under both nominal and edge-case conditions. This stage builds the runtime safety net every pipeline execution leans on — a pipeline without it ships bad data silently, and the consumers find out before the on-call does.

## Scope

Building the executable data-quality suite plus the reconciliation checks that compare source counts and key totals against the target. Validation decides *what "correct data" means in checks and what passes* — it does not fix the transformation logic it tests (that's a revisit to transformation) or deploy anything (deployment).

## What to do

- Cover schema compliance, uniqueness, not-null, referential integrity, value ranges, row-count reconciliation, and business-rule assertions for each verification surface.
- Give every check explicit pass / fail / warning semantics and a stated threshold.
- Test edge-case conditions, not just the happy path the transformation already handles.
- Record each check's scope, threshold, and latest run result so the suite is auditable.

## What NOT to do

- Don't fix the model or transformation code when a check fails — file the finding back to transformation.
- Don't build connectors or modify staging — that's extraction.
- Don't deploy or operationalize the pipeline — that's deployment.
- Don't pass a surface with a check left unwritten; an untested rule is a silent failure waiting to happen.
