# Cutover Stage — Execution

## Per-unit baton (`cutover-coordinator → rollback-engineer → verifier`)

Every cutover unit walks three hats in `plan → do → verify` order:

1. **`cutover-coordinator` (plan / do for the forward step):** Reads the validation report and the assessment-stage ordering constraints, then authors the runbook entry for this step — preconditions, owner, expected duration (cited to a rehearsal), action, post-condition check (mechanical pass / fail), go / no-go criteria, communication triggers, rollback step id, point-of-no-return marker if applicable. Hands off when every field on the runbook-entry template is populated.
2. **`rollback-engineer` (do for the reverse procedure):** Reads the coordinator's forward step, classifies reversibility (fully / with-loss / at-cost / forward-fix-only), and authors the matching rollback entry — paired step id, mirrored structure, reverse procedure, reverse duration fitting in the cumulative RTO, post-cutover write handling. Cites the validation rehearsal record. Hands off when the rollback entry is paired one-to-one with the forward step (or an explicit forward-fix rationale is in place).
3. **`verifier` (verify):** Validates that preconditions, action, post-condition, and rollback (or forward-fix rationale) are all stated, the post-condition produces a mechanical pass / fail signal, and the rollback rehearsal is cited. Advances or rejects.

The baton: the forward and reverse halves of the same step accumulate in one unit body. The verifier reads both and decides.

## After execute completes

When every cutover unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — `rollback-readiness` and any studio-level review agents fire in parallel. Upstream review lenses (`migrate/data-integrity`, `validation/parity`) are included via the stage's `review-agents-include`.
3. **Fix loop (if any feedback opens)** — `fix_hats:` chain (`classifier → cutover-coordinator → feedback-assessor`) dispatches per finding. The classifier routes; `cutover-coordinator` re-authors the runbook step; `feedback-assessor` closes.
4. **Gate** — The stage's gate is `external`. The runbook must be approved through the team's actual change-management surface (incident-management platform, change ticket, on-call lead signoff) before cutover proceeds. Project overlays MUST configure that surface; the plugin default doesn't assume a specific tool.

## Reviewer guidance specific to this stage

- **A runbook step without a paired rollback entry** (and without an explicit forward-fix rationale) is the highest-priority finding. Rollback can't be improvised at 2am.
- **Point-of-no-return marker missing or duplicated** along a dependency chain is a hard finding — it determines which rollback paths are real and which are forward-fix-only.
- **Rollback rehearsal record not cited** means the rollback is unproven — file feedback against validation if the rehearsal hasn't happened; don't try to rehearse inside cutover.
- **Judgment-based go / no-go criteria** ("looks okay", "if it seems right") under production pressure produce outages. Mechanical pass / fail or reject the step.
- **Post-cutover write handling unaddressed** for steps where the target accepts writes is a hidden gap — silent loss of post-cutover writes is the worst rollback bug.
