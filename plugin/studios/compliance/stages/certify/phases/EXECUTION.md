# Certify Stage — Execution

## Per-unit baton (`audit-liaison → finding-resolver → verifier`)

Every certify unit walks the three hats in `plan → do → verify` order. Units here are operational: each describes preconditions, an action (submission, interview, finding response), and a verifiable post-condition.

1. **`audit-liaison` (plan / do for engagement):** Reads `EVIDENCE-PACKAGE.md`, the auditor's request list, and any prior submission to this auditor. Maps the auditor's requests to evidence items, converts formats where needed (preserving the conversion trace), submits via the auditor's portal / process with timestamps recorded, briefs stakeholders for any interviews, and maintains the inquiry log against the auditor's SLA. Hands off (or yields the unit to `finding-resolver` via classifier) when submission and inquiry-handling are current.
2. **`finding-resolver` (do for closure):** Reads each auditor finding verbatim. Performs root-cause analysis (surface vs cause vs contributing factors), chooses the resolution path (fix / mitigate / accept), authors the response with quoted finding text + root cause + action taken + evidence + status. Routes fix-class work that needs real engineering back into `remediate` via feedback. Hands off when every returned finding has a complete documented response.
3. **`verifier` (verify):** Reads the unit body. Validates that preconditions are stated, the action is unambiguous, the post-condition has a verifiable check, rollback is named where applicable (or "no rollback — forward-fix only" with rationale), decision-register alignment holds, and open questions are accounted for. Either advances or rejects.

## After execute completes

When every unit's chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — universal hard gate; the built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — the stage's `audit-readiness` lens fires alongside the included upstream lenses (`assess.thoroughness`, `remediate.effectiveness`) and any studio-level review agents.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, audit-liaison, feedback-assessor]` dispatches per finding; the classifier routes the FB, `audit-liaison` re-submits or re-formats as the implementer (escalating substantive responses to `finding-resolver` via classifier), the assessor independently decides closure.
4. **Gate** — `[external, await]`. The auditor's decision is the approval signal; the stage blocks waiting for that external event. There is no local fallback because no local sign-off can substitute for the external attestation that is the whole point of this stage.
