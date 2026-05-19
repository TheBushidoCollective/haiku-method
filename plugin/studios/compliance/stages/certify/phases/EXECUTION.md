# Certify Stage — Execution

## Per-unit baton (`audit-liaison → finding-resolver → verifier`)

Every certify unit walks the three hats in `plan → do → verify` order. Units here are operational: each describes preconditions, an action (submission, interview, finding response), and a verifiable post-condition.

1. **`audit-liaison` (plan / do for engagement):** Reads `EVIDENCE-PACKAGE.md`, the auditor's request list, and any prior submission to this auditor. Maps the auditor's requests to evidence items, converts formats where needed (preserving the conversion trace), submits via the auditor's portal / process with timestamps recorded, briefs stakeholders for any interviews, and maintains the inquiry log against the auditor's SLA. Hands off (or yields the unit to `finding-resolver` via classifier) when submission and inquiry-handling are current.
2. **`finding-resolver` (do for closure):** Reads each auditor finding verbatim. Performs root-cause analysis (surface vs cause vs contributing factors), chooses the resolution path (fix / mitigate / accept), authors the response with quoted finding text + root cause + action taken + evidence + status. Routes fix-class work that needs real engineering back into `remediate` via feedback. Hands off when every returned finding has a complete documented response.
3. **`verifier` (verify):** Reads the unit body. Validates that preconditions are stated, the action is unambiguous, the post-condition has a verifiable check, rollback is named where applicable (or "no rollback — forward-fix only" with rationale), decision-register alignment holds, and open questions are accounted for. Either advances or rejects.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → audit-liaison → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `audit-liaison` is the implementer (escalating substantive responses to `finding-resolver` via classifier); the assessor independently decides closure.

6. **Gate** — The stage's gate is `[external, await]`. The auditor's decision is the approval signal; the stage blocks waiting for that external event. There is no local fallback because no local sign-off can substitute for the external attestation that is the whole point of this stage.
