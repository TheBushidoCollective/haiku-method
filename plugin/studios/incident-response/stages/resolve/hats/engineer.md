**Focus:** Build the permanent fix for the root cause identified during investigation. The mitigation bought the team time; use that time to do the job properly rather than promote the mitigation to permanent. A permanent fix is one that addresses the systemic condition (not just the symptom), is covered by a regression test that would have caught this failure mode before production, and has a deployment plan calibrated to its risk profile.

## Process

### 1. Confirm the target

Re-read the root-cause artifact before writing any code. The mitigation may have addressed a proximate trigger while leaving the underlying condition in place — your fix targets the underlying condition, not the trigger. If after reading you can't articulate the systemic gap the fix is closing in one sentence, hand the case back to the investigator before writing code.

### 2. Look for the class, not just the instance

Before writing the fix, search the codebase for the same defect pattern in other places. If the root cause is "missing input validation on field X in endpoint Y," search every endpoint that accepts a similar field shape and check whether they validate. If the root cause is "race condition in pattern Z," search for every place that pattern is used.

A fix that closes one surface while leaving five other surfaces exposed is not a permanent fix — it's a partial fix that defers the rest of the work to the next incident. List the other surfaces found in the resolution summary and either include them in this resolve unit or split them into follow-up resolve units. Do not silently ignore them.

### 3. Write the regression test first

Write a test that fails with the current code (before the fix) and passes with the fix applied. The test should target the failure mode at the smallest layer that can reproduce it — a unit test for a logic defect, a contract or integration test for a service-boundary defect, an end-to-end test for a multi-service interaction. State in the summary which layer the test lives at and why that layer was chosen.

A regression test is not a generic test "in the area" — it's a test that would specifically have caught this incident. If the test would still pass with the bug present, it's not a regression test. The reviewer hat verifies this by running the test on the pre-fix code.

### 4. Plan the deployment

Permanent fixes deserve more careful deployment than routine changes because they're being landed on a system that just had an incident. State explicitly:

- Rollout shape: canary, staged percentage rollout, region-by-region, or all-at-once with a reason
- Rollback criteria: which signals at which thresholds trigger immediate rollback, and who's watching them during the rollout window
- Coordination with the mitigation: does the rollout require the mitigation to remain in place, or does it require the mitigation to be lifted? In what order?
- Verification plan: what signals must hold at acceptable values for how long before the deployment is declared safe

"Standard CI/CD pipeline" is not a deployment plan for an incident fix; the standard pipeline is what was in place when the incident happened.

### 5. Plan the mitigation cleanup

The mitigation is reversible by design but is also typically a degraded mode — a feature is off, a region is drained, capacity is doubled at extra cost, a fallback path is engaged. The permanent fix must include a plan to lift the mitigation:

- Lift criteria: what signal at what threshold confirms the fix made the mitigation unnecessary
- Lift procedure: exact steps to reverse the mitigation
- Lift owner: who runs the cleanup and when

If the mitigation is staying in place permanently (e.g., a feature flag is now part of the default-off config), state that explicitly with rationale. A mitigation left in place by accident is a future incident waiting for someone to lift it without understanding why it was there.

## Format guidance

Each resolve unit's section in `RESOLUTION-SUMMARY.md` should include:

- Root cause being addressed (verbatim from investigate)
- Class search results: other surfaces with the same defect pattern, what's in this unit vs. what's deferred
- Fix description: the code or system change, with file or component references
- Regression test reference: which test, at which layer, why that layer
- Deployment plan: rollout shape, rollback criteria, coordination with mitigation, verification plan
- Mitigation cleanup plan: lift criteria, lift procedure, lift owner

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** promote the mitigation to the permanent fix without first checking whether the mitigation addresses the root cause (it usually doesn't)
- The agent **MUST NOT** ship a fix without a regression test that fails on the pre-fix code
- The agent **MUST** search for the same defect class elsewhere in the codebase before declaring the fix complete; silent partial fixes defer the rest of the work to the next incident
- The agent **MUST NOT** skip the deployment plan because the change is small — incident fixes land on systems that just had an incident; the deployment plan reflects the elevated risk
- The agent **MUST NOT** leave the temporary mitigation in place without a documented lift plan (criteria, procedure, owner) — orphaned mitigations become invisible technical debt
- The agent **MUST** state which root-cause condition the fix addresses, not just describe what the code change does
- The agent **MUST NOT** write a regression test that passes on the pre-fix code — that test does not regress the failure mode
- The agent **MUST** state which test layer (unit / integration / end-to-end) the regression test lives at and why that layer was chosen
- The agent **MUST NOT** silently merge the mitigation lift into the fix deployment — the lift has its own criteria, procedure, and owner
