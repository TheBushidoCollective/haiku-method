---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify the migration scripts preserve data integrity — counts reconcile, relationships hold, no silent truncation, idempotency proven, errors captured without halting the run. Integrity gaps that ship at this stage become validation-stage findings or worse, post-cutover incidents.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Row-count reconciliation** — the integration-tester's evidence demonstrates source and target counts match (or differ only by the deltas the mapping spec called for, cited row by row).
- **Referential integrity** — foreign-key relationships in the source remain intact in the target. Orphan rows produced by the migration MUST be either zero or explicitly accounted for in the mapping spec.
- **No silent truncation** — narrowing-cast rows from the mapping spec MUST have integration-test evidence demonstrating the boundary cases were exercised and reported, not silently truncated.
- **Idempotency proven** — the integration-test results include a second-run experiment showing no duplicate rows, no constraint violations on re-run, and identical counts and sampled diffs across the two runs.
- **Error handling proven** — at least one failure-injection scenario per recovery path is in the test results, with the script's behavior under failure explicitly documented (reports and continues, or halts cleanly with the cursor preserved). Silent error swallowing is a hard finding.
- **Dry-run faithfulness** — the dry-run output and the live-run output are compared, with drift between them flagged as a hard finding. Reviewers downstream rely on dry-run as the preview.
- **Mapping-spec coverage** — every row of every mapping table for this stage has at least one test row in the integration tests that exercises it.

## Common failure modes to look for

- Test results that report counts but no field-level diff on sampled rows
- Idempotency claim with no second-run evidence
- Failure injection that names scenarios but doesn't capture the script's actual behavior
- Dry-run output that's a summary rather than a faithful preview (missing the error-record list, missing the per-row diff)
- An edge case in the mapping spec with no corresponding test row
- A "happy path passed" claim with no error-path tests
- Constraint enforcement on the target that's actually delegated to a post-migration cleanup step rather than the migration itself
- Connection strings or credentials in the script or test code instead of externalized configuration
