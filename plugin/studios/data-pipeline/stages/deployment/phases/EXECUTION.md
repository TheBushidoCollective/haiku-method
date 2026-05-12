# Deployment Stage — Execution

## Per-unit baton (`pipeline-engineer → sre → verifier`)

Every deployment unit walks the three hats. The baton is the orchestrator-registered configuration, its monitoring / alerting / runbook surface, and the verified-readiness signal:

1. **`pipeline-engineer` (plan / do):** Reads validation's `VALIDATION-REPORT.md` and the user's SLAs. Registers the pipeline with the orchestrator — schedule, explicit upstream / downstream dependencies, retry / timeout policies, resource limits sized for projected peak, structured logging, lineage capture. Tests the full DAG end-to-end in staging across both success and failure paths. Defines the first-run plan and rollback steps. Hands off when the pipeline is deployment-ready and the staging tests have exercised realistic failure modes.
2. **`sre` (do / verify):** Verifies alert routing reaches a real on-call channel with a real schedule, monitoring covers data freshness / volume / quality and not just success, runbooks are actionable by an unfamiliar engineer, backfill procedures exist and have been tested at realistic volume, and SLA monitors alert before SLAs break. Advances on pass; rejects with the specific readiness gap named on fail.
3. **`verifier` (verify):** Reads the unit body only. Validates substance, citation, internal consistency, and decision-register accountability. Advances on pass; rejects with the responsible hat named on fail.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The `reliability` review agent fires; the imported `data-quality` (from transformation) and `coverage` (from validation) agents also fire per `review-agents-include:` so deployment doesn't pass a pipeline whose upstream stages have regressed since their original gates. Each files feedback for any gap.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, pipeline-engineer, feedback-assessor]` dispatches per finding. The classifier routes the FB; the pipeline-engineer re-authors the affected configuration / monitoring / runbook; the assessor independently decides closure.
4. **Gate** — `review: external` — production deployment requires the team's external approval mechanism (PR merge in the orchestrator repo, change-management ticket, on-call signoff) to land. The agent does not self-approve a production deployment.

## Reviewer guidance specific to this stage

- **Alerts routed to a void** (chat channel nobody owns, ticket queue with no on-call schedule) is the highest-priority finding — monitoring that fires nowhere is worse than no monitoring because it gives false comfort.
- **Monitoring covers success only** is the second-highest — a pipeline that runs successfully and emits zero rows looks healthy until consumers notice the data hasn't moved.
- **Backfill never tested in staging** is the third — every production pipeline eventually needs to reprocess history; a backfill procedure that has never been exercised won't work when it's needed.
- **Resource limits set to default** is the fourth — a pipeline sized for current average load will hit limits at projected peak, and the symptom is "the pipeline is suddenly slow" rather than "we sized too small".
- **First-run plan is 'ship it and see'** is the fifth — the highest-risk run is the first one, and an unplanned rollback during the first run usually means data corruption that takes days to clean up.
