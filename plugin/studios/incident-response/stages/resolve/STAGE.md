---
name: resolve
description: Implement permanent fix with proper testing and review
hats: [engineer, reviewer]
fix_hats: [classifier, engineer, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: mitigate
    discovery: mitigation-log
---

# Resolve

Build the permanent fix. The mitigate stage stopped the bleeding with a reversible action; the investigate stage produced a root cause. The resolve stage's job is to land a code or system change that actually addresses the root cause, ships a regression test that would have caught this incident before it reached production, and includes a plan to remove the temporary mitigation once the permanent fix is verified. This is also where the team checks whether the same class of defect exists elsewhere in the codebase — a fix that only patches the one instance leaves the underlying weakness in place for the next surface to hit.

## Per-unit baton

Each resolve unit walks `engineer → reviewer` in order. A unit here is one discrete fix — one code change, one schema migration, one config-system change, one infrastructure remediation:

- **`engineer`** (plan + do) writes the permanent fix targeted at the root cause from the investigate stage, writes the regression test that fails without the fix, plans the deployment (canary / staged rollout with rollback criteria), and plans the mitigation-cleanup step. The baton: a `RESOLUTION-SUMMARY.md` slice with the diff, the test, the deployment plan, and the mitigation-cleanup plan.
- **`reviewer`** (verify) reads the diff with the root cause in hand, verifies the regression test actually fails without the fix applied, checks the deployment plan against the residual risk profile, confirms the mitigation cleanup is included or scheduled, and advances or rejects to the engineer.

This stage runs `plan → do → verify` with the engineer carrying plan-and-do because the fix is the plan; separating them adds coordination cost without adding rigor for typical incident remediation. Larger architectural fixes that exceed one engineer's scope should be split into multiple resolve units rather than wedged into a single big unit.

## Inputs and outputs

Consumes `mitigate/mitigation-log` — the record of what mitigation is currently in place and what it's holding back. Also consumes (indirectly through the unit body) `investigate/root-cause` — the diagnosed cause that the fix must address. Produces `RESOLUTION-SUMMARY.md` containing the fix details, regression-test references, deployment plan, mitigation-cleanup plan, and check for related defects elsewhere in the codebase.

## Fix loop and gate

When review feedback opens against a fix, `fix_hats: [classifier, engineer, feedback-assessor]` dispatches per finding. The engineer re-owns the corrected fix. The gate is `ask` because the permanent fix is a deliberate code change that benefits from a human approval round — by this point the incident is mitigated and urgency has dropped, so a synchronous human review is appropriate rather than the time-pressured `auto` of the triage and investigate stages.
