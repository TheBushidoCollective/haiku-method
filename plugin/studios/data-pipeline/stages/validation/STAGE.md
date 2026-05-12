---
name: validation
description: Validate data quality, schema compliance, and business rules
hats: [validator, data-quality-reviewer]
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

Prove that the transformed data conforms to the model and the business rules,
under both nominal and edge-case conditions. This stage builds the data-
quality test suite that runs every time the pipeline executes, plus the
reconciliation checks that compare source row counts and key totals against
the target. A pipeline without validation is a pipeline that ships bad data
silently — and the consumers find out before the on-call does.

## Per-unit baton

Each validation unit is one **verification surface** — typically one target
table or one business-rule family — with the tests that cover it. The unit
walks the two hats:

- **`validator`** (do) writes the data-quality checks: schema compliance,
  uniqueness, not-null, referential integrity, accepted value ranges, row-
  count reconciliation, and business-rule assertions, each with explicit
  pass / fail / warning semantics
- **`data-quality-reviewer`** (verify) reviews the suite for coverage gaps
  and assertion quality — does every critical path have tests, are
  thresholds tight, do failures emit enough context to debug

The stage also imports the `correctness` review agent from `extraction` so
end-to-end source-to-target faithfulness is reviewed in the same pass.

## Inputs and outputs

Modeled data from transformation is the input. The stage produces
`VALIDATION-REPORT.md` (intent-scope) — the catalog of every check, its
scope, its threshold, and the most recent run result — plus the executable
test definitions referenced by the report.

## Fix loop and gate

`fix_hats: [classifier, validator, feedback-assessor]` dispatches per finding.
The gate is `ask` — a human approves the validation suite before deployment,
because the suite is the runtime safety net for everything downstream.
Project overlays may add team-specific assertion libraries, threshold
defaults, or alerting conventions without modifying plugin defaults.
