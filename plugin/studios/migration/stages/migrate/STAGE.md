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

Implement the mapping spec as runnable migration code — extractors, transforms, loaders, idempotency keys, dry-run modes, checkpointing — and prove it does what the spec says with integration-test evidence. This is the build stage of the migration: units are execution work with acceptance criteria and executable verify commands.

## Scope

Implementation of the mapping spec plus the integration-test evidence that the implementation honors it. Migrate decides *how the data actually moves* — not what maps to what (mapping) or whether the migrated target reconciles against the source (validation). The mapping spec is the contract; the code implements it and nothing beyond it.

## What to do

- Implement extract, transform, and load for each entity surface against its mapping rows, with error handling, idempotency, dry-run support, and checkpointing.
- Produce integration-test evidence against a non-production target: happy path, mapping-derived edge cases, and an idempotency proof that a re-run produces no duplicates.
- Trace every implementation behavior back to a mapping-spec row and every test back to a behavior.
- Keep verify commands executable so the result is mechanically checkable.

## What NOT to do

- Don't reinterpret or extend the mapping spec — a wrong spec is a revisit to mapping, not a change made in the code.
- Don't run reconciliation or parity testing here; that's validation against the artifacts you produce.
- Don't advance with failing integration tests or an unproven idempotency claim.
- Don't migrate a surface the mapping spec didn't cover.
