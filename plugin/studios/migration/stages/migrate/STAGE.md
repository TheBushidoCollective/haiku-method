---
name: migrate
description: Implement migration scripts, adapters, and data transforms
hats: [migration-engineer, integration-tester, verifier]
fix_hats: [classifier, migration-engineer, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: mapping
    discovery: mapping-spec
---

# Migrate

Implement the mapping spec as runnable migration code — extractors, transforms, loaders, idempotency keys, dry-run modes, checkpointing. This is the build stage of the migration studio: units are execution-class (discrete pieces of work with acceptance criteria and executable verify commands), and the output is the migration code itself plus the integration-test evidence that it does what the spec says.

## Per-unit baton

Each migrate unit walks three hats in `plan → do → verify` order:

- **`migration-engineer`** (plan / do) reads the mapping rows for this entity / surface and implements the migration logic — extract, transform, load, error handling, idempotency, dry-run support, checkpointing.
- **`integration-tester`** (do for test evidence) consumes the implementation and produces the integration-test results against a non-production target — happy path, edge cases derived from the mapping spec, idempotency proof (re-run produces no duplicates), failure-injection results.
- **`verifier`** (verify) validates the unit body against the migrate-stage verify rules (spec match, executable verify-commands, acceptance criteria paired with concrete pass/fail signals). Advances or rejects to the responsible hat.

The baton is the unit's body content accumulating on disk: implementation references mapping-spec rows; tests reference implementation behaviors; verifier reads both.

## Inputs and outputs

Migrate consumes `mapping/mapping-spec` and produces `MIGRATION-ARTIFACTS.md` (the index of migration scripts / adapters / transforms with their entry points, dry-run invocations, and integration-test evidence). The validation stage consumes the artifacts to run reconciliation.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, migration-engineer, feedback-assessor]` dispatches per finding. The classifier routes; `migration-engineer` re-authors the affected script or test; `feedback-assessor` closes. The gate is `ask` — local approval once the integration tests pass and the data-integrity review agent has signed off.
