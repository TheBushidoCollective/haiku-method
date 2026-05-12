# Extraction Stage — Execution

## Per-unit baton (`extractor → connector-reviewer`)

Every extraction unit walks two hats. The baton is the connector implementation, its run-metadata schema, and its declared behavior under failure / drift:

1. **`extractor` (do):** Reads the discovery brief's integration-pattern decision and the schema-analyst's profile. Implements the connector — incremental logic, watermarks, retry / backoff, schema-drift detection, dead-letter handling, queryable run metadata. Idempotency is non-negotiable; re-runs MUST converge to the same staged state. Hands off when the connector implements the pattern faithfully, every failure mode has a defined behavior, and metadata is captured queryably.
2. **`connector-reviewer` (verify):** Reads the connector and its declared behavior. Probes idempotency (same window, replay, partial-failure), failure handling (network / rate-limit / auth / malformed records), schema-drift handling, and operational debugability. Advances on pass; rejects with the specific failed check named on fail.

The plan role is implicit — the discovery stage's source catalog has already chosen the integration pattern, so the extractor reads that decision rather than re-planning it. A future revision may split a planner role back out if integration-pattern decisions start getting re-litigated mid-unit.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The `correctness` review agent fires and files feedback for any field-coverage, idempotency, error-handling, source-load-safety, schema-drift, or metadata gap.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, extractor, feedback-assessor]` dispatches per finding. The classifier routes the FB; the extractor re-authors the affected connector logic; the assessor independently decides closure.
4. **Gate** — `review: ask` blocks for a human to review extraction logic before it lands in staging. The reviewer probes the same idempotency / failure / drift surfaces the verify hat probed.

## Reviewer guidance specific to this stage

- **Idempotency without a stated mechanism** is the highest-priority finding — "should be safe to re-run" is not a contract; the mechanism (transactional commit, idempotency key, atomic swap, sequence-number dedup) is the contract.
- **Watermark advances before staging commit** is the second-highest-priority finding — this is the silent class of bug that causes "we lost three hours of data when the connector crashed".
- **Silent schema drift handling** (truncating new columns, coercing type changes, ignoring missing columns) is the third — every drift event needs an operator-decided handling path, not a default that hides the change.
