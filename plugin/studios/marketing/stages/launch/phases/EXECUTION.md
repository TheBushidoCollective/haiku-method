# Launch Stage — Execution

## Per-unit baton (`campaign-manager → channel-coordinator → verifier`)

Every launch unit walks the three hats in order. The baton is the operational contract for one launch step:

1. **`campaign-manager` (plan):** Reads the approved content, the strategy's channel mix, and dependencies on sibling launch units. Defines preconditions, action, post-condition check, and rollback / forward-fix path for this step. Hands off when every section of the operational contract is concrete and verifiable.
2. **`channel-coordinator` (do):** Confirms preconditions hold, executes the action exactly as defined, verifies the post-condition signal within the named window, captures actual timestamps and initial signals, and logs to the campaign log. Hands off when the step has fired AND the post-condition signal is confirmed AND the log entry is complete.
3. **`verifier` (verify):** Reads the unit body and runs the preconditions-action-post-condition / verifiable-check / rollback / decision-register / open-questions checks from `hats/verifier.md`. Advances on pass, rejects to the responsible hat on fail.

The hat order is `plan → do → verify` because the manager defines the contract, the coordinator runs against it, and the verifier confirms the contract was honored. The rally-race test (architecture §2.3) is met because the baton (the operational contract → the executed step + log entry → the validated launch record) is substantively different at each handoff.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `readiness` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `readiness` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → campaign-manager → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `campaign-manager` is the implementer (re-authors the operational contract where the finding lands); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. The user confirms each readiness check before the launch actually fires, because once channels are activated the cost of recall is real.

## Reviewer guidance specific to this stage

- **Implicit dependencies between launch units** are the highest-priority finding. "Obviously the landing page should be up before paid traffic" is how launches break — dependencies must be explicit so the engine can sequence correctly.
- **Tracking-confirmation gaps** (paid traffic activated before tracking is confirmed firing, attribution parameters not in preconditions) are how the measure stage ends up with un-attributable wins and losses. Treat as a hard block.
- **Non-idempotent actions without a rollback or forward-fix path** are the single most expensive operational failure mode. "No rollback — forward-fix only" is acceptable; silent absence of either is not.
- **Vague post-condition checks** ("verify performance is good") leak failures into the live campaign. Every check must name the signal, the source, the window, and the negative-case signal.
