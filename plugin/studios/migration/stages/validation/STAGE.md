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

Prove the migrated target matches the source — quantitatively through counts, hashes, and sampled reconciliation, and functionally by showing downstream consumers produce identical results. This is the stage that gates cutover: if it can't show parity, the migration isn't ready to go live. It also owns rehearsing the rollback end-to-end.

## Scope

Reconciliation, functional-parity testing, performance benchmarking, and rollback rehearsal. Validation decides *whether the migrated target is correct and the rollback works* — not how the data moved (migrate) or how the production cutover is sequenced (cutover). Units are verification surfaces, each naming its method, threshold, and mechanical pass/fail criteria.

## What to do

- Produce quantitative reconciliation evidence — row counts, hash digests, sampled field-by-field diffs, constraint and referential-integrity checks.
- Replay production queries, workflows, and consumer flows against both systems and compare output side by side, including performance deltas.
- Exercise the rollback procedure end-to-end against a representative dataset and record the rehearsal.
- Anchor every parity claim to reconciled data, and state each surface's threshold and evidence shape.

## What NOT to do

- Don't fix the migration code here — file findings; the migrate stage owns corrections.
- Don't plan or execute the production cutover; that's the cutover stage consuming this report.
- Don't claim parity from a test that doesn't cite reconciled data.
- Don't advance without the rollback rehearsal — cutover will refuse to proceed without it.
