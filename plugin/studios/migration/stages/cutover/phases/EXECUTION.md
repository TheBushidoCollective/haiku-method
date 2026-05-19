# Cutover Stage — Execution

## Per-unit baton (`cutover-coordinator → rollback-engineer → verifier`)

Every cutover unit walks three hats in `plan → do → verify` order:

1. **`cutover-coordinator` (plan / do for the forward step):** Reads the validation report and the assessment-stage ordering constraints, then authors the runbook entry for this step — preconditions, owner, expected duration (cited to a rehearsal), action, post-condition check (mechanical pass / fail), go / no-go criteria, communication triggers, rollback step id, point-of-no-return marker if applicable. Hands off when every field on the runbook-entry template is populated.
2. **`rollback-engineer` (do for the reverse procedure):** Reads the coordinator's forward step, classifies reversibility (fully / with-loss / at-cost / forward-fix-only), and authors the matching rollback entry — paired step id, mirrored structure, reverse procedure, reverse duration fitting in the cumulative RTO, post-cutover write handling. Cites the validation rehearsal record. Hands off when the rollback entry is paired one-to-one with the forward step (or an explicit forward-fix rationale is in place).
3. **`verifier` (verify):** Validates that preconditions, action, post-condition, and rollback (or forward-fix rationale) are all stated, the post-condition produces a mechanical pass / fail signal, and the rollback rehearsal is cited. Advances or rejects.

The baton: the forward and reverse halves of the same step accumulate in one unit body. The verifier reads both and decides.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → cutover-coordinator → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `cutover-coordinator` is the implementer (re-authors the runbook step); the assessor independently decides closure.

6. **Gate** — The stage's gate is `external`. The runbook must be approved through the team's actual change-management surface (incident-management platform, change ticket, on-call lead signoff) before cutover proceeds. Project overlays MUST configure that surface; the plugin default doesn't assume a specific tool.

## Reviewer guidance specific to this stage

- **A runbook step without a paired rollback entry** (and without an explicit forward-fix rationale) is the highest-priority finding. Rollback can't be improvised at 2am.
- **Point-of-no-return marker missing or duplicated** along a dependency chain is a hard finding — it determines which rollback paths are real and which are forward-fix-only.
- **Rollback rehearsal record not cited** means the rollback is unproven — file feedback against validation if the rehearsal hasn't happened; don't try to rehearse inside cutover.
- **Judgment-based go / no-go criteria** ("looks okay", "if it seems right") under production pressure produce outages. Mechanical pass / fail or reject the step.
- **Post-cutover write handling unaddressed** for steps where the target accepts writes is a hidden gap — silent loss of post-cutover writes is the worst rollback bug.
