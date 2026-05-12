---
name: validation
description: Verify data integrity, functional parity, and performance
hats: [validator, regression-tester, verifier]
fix_hats: [classifier, validator, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: migrate
    discovery: migration-artifacts
review-agents-include:
  - stage: mapping
    agents: [accuracy]
---

# Validation

Prove the migrated target matches the source — quantitatively (counts, hashes, sampled reconciliation) and functionally (downstream consumers produce identical results). This is the validation stage of the migration studio: units are verification surfaces (a reconciliation method, a parity test, a performance benchmark), and the output is the validation report that gates cutover.

## Per-unit baton

Each validation unit walks three hats in `plan → do → verify` order:

- **`validator`** (plan / do for quantitative reconciliation) reads the migration artifacts for this surface and produces the reconciliation evidence — row counts, hash digests, sampled field-by-field diffs, constraint and referential-integrity checks.
- **`regression-tester`** (do for functional parity) consumes the reconciliation results and produces the parity evidence — replayed production queries / workflows / consumer flows, with side-by-side output comparison and performance deltas.
- **`verifier`** (verify) validates that each verification surface names its method, threshold, evidence shape, and mechanical pass/fail criteria. Advances or rejects.

The baton: validator's reconciliation evidence is the precondition for regression-tester's parity claims; a parity test that doesn't cite reconciled data is a sign the validator missed a surface.

This stage also owns **rollback rehearsal** — at least one unit MUST exercise the rollback procedure end-to-end against a representative dataset and produce the rehearsal record. Cutover's `rollback-readiness` review agent will refuse to advance without it.

## Inputs and outputs

Validation consumes `migrate/migration-artifacts` and the upstream `mapping/accuracy` review lens. Output is `VALIDATION-REPORT.md` (reconciliation results + parity test results + performance benchmarks + the rollback rehearsal record). Cutover consumes the report to decide go / no-go.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, validator, feedback-assessor]` dispatches per finding. The classifier routes; `validator` re-runs or re-authors the affected reconciliation; `feedback-assessor` closes. The gate is `ask` — local approval after the report is complete and review agents have signed off.
