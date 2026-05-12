# Resolve Stage — Execution

## Per-unit baton (`engineer → reviewer`)

Every resolve unit walks the two hats in order. The baton across the rally race is the unit's slice of `RESOLUTION-SUMMARY.md` accumulating on disk:

1. **`engineer` (plan + do):** Reads the root-cause artifact from investigate and the mitigation log from mitigate. Confirms the target (the systemic condition, not the proximate trigger), searches the codebase for the same defect class elsewhere, writes the permanent fix, writes a regression test that fails on the pre-fix code, plans the deployment (rollout shape, rollback criteria, coordination with the current mitigation, verification plan), and plans the mitigation cleanup (lift criteria, lift procedure, lift owner). Hands off with the diff, the test reference, the deployment plan, and the mitigation-cleanup plan all written into the unit.
2. **`reviewer` (verify):** Reads the root-cause artifact first, then the diff with the root cause in hand. Verifies the fix targets the systemic condition (not just the surface that hit the incident), the regression test actually fails on the pre-fix code, the class search was substantive, the deployment plan reflects post-incident risk, and the mitigation cleanup plan is concrete. Advances on all-pass; rejects with the specific failed check named.

The hat order is `plan → do → verify` with the engineer carrying plan-and-do because the fix is the plan; separating planner and doer adds coordination cost without adding rigor for the typical incident remediation. Larger architectural fixes that exceed one engineer's scope should be split into multiple resolve units rather than wedged into a single big unit.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's review agents (`correctness`) and any studio-level review agents fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → engineer → feedback-assessor`) dispatches against each open feedback. The engineer re-owns the corrected fix because code changes and test design are engineer-scope; the assessor independently decides closure.
4. **Gate** — The stage's gate is `ask` because the permanent fix is a deliberate code change that benefits from a human approval round. By this point the incident is mitigated and urgency has dropped, so a synchronous human review is appropriate rather than the time-pressured `auto` of the upstream stages.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Fix targets symptom rather than root cause** is the highest-priority finding. A fix that closes the specific failure mode without addressing the systemic condition the investigate stage diagnosed leaves the underlying weakness for the next surface to hit.
- **Regression test that passes on pre-fix code** is next — the test exists but doesn't regress the failure, so the gate that's supposed to catch this incident class in the future is decorative.
- **Silent partial fix** is a quiet but important finding — the engineer fixed the surface the incident hit but didn't search for the same defect class elsewhere, so the next incident in the class is queued up.
- **Missing mitigation cleanup plan** leaves the mitigation in place indefinitely, becoming invisible debt; the postmortem stage will then carry the cleanup as an action item rather than the resolve stage carrying it as a deliverable.
- **"Standard CI/CD" deployment plan** ignores the elevated risk profile of landing a fix on a system that just had an incident.
