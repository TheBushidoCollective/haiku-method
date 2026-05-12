# Validation Stage — Execution

## Per-unit baton (`validator → data-quality-reviewer`)

Every validation unit walks two hats. The baton is the test suite — its assertions, its reconciliation logic, its severity mix, its diagnostic context:

1. **`validator` (do):** Reads the data-modeler's `DATA-MODEL.md`, the extraction stage's `EXTRACTION-JOBS.md`, and the user's stated SLAs. Writes assertions covering the four families (schema compliance, uniqueness / integrity, value-range, business rules). Builds source-to-target reconciliation with stated tolerances and per-partition coverage where the partitioning matches. Covers freshness SLAs with watermark-based checks. Distinguishes blocking from non-blocking severities deliberately. Wires diagnostic context on every failing assertion. Hands off when the suite covers every entity in scope at the right severity with actionable diagnostics.
2. **`data-quality-reviewer` (verify):** Reads the suite. Traces coverage back to the model and the SLAs. Probes assertion specificity, threshold tightness, failure-mode actionability, severity mix sanity, and explicit-gap disclosure. Advances on pass; rejects with the specific gap or weakness named on fail.

The plan role is implicit — the transformation stage's data model has already defined the entities and the business rules, so the validator reads those decisions rather than re-planning them.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The `coverage` review agent fires; the imported `correctness` agent from extraction also fires (per `review-agents-include:`) so end-to-end faithfulness is reviewed in the same pass. Each files feedback for any gap.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, validator, feedback-assessor]` dispatches per finding. The classifier routes the FB; the validator extends or tightens the suite; the assessor independently decides closure.
4. **Gate** — `review: ask` blocks for a human to approve the validation suite before deployment. The suite is the runtime safety net for everything downstream; an unreviewed suite is a contract no one read.

## Reviewer guidance specific to this stage

- **Business-rule coverage missing** is the highest-priority finding — a suite that covers schema but skips business rules will pass while the data is silently wrong, which is the failure mode validation exists to prevent.
- **Reconciliation without per-partition coverage** when the source and target are partitioned by the same dimension is the second-highest — aggregate reconciliation hides partition-level drift (e.g., a region that lost its feed but other regions over-filled the aggregate).
- **Freshness "check" implemented as pipeline success** is the third — a successful run that emits zero rows looks healthy by run-status and broken by data-status.
- **Severity mix is all-blocking or all-warning** indicates the validator didn't think about severity — both extremes break the safety-net contract in opposite directions.
