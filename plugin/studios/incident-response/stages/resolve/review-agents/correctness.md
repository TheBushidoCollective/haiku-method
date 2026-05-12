---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that the permanent fix addresses the actual root cause (not just the symptom), is covered by a regression test that would have caught this incident before production, and ships with a deployment plan and mitigation-cleanup plan calibrated to the post-incident risk profile.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Root-cause targeting** — The fix addresses the systemic condition named in the investigate-stage root cause, not a downstream symptom the mitigation already covered. A fix that prevents the trigger without closing the underlying gap leaves the next trigger free to recur.
- **Regression test fails on pre-fix code** — The named test asserts the failure mode and demonstrably fails when the fix is removed. A test that passes on both versions is not regression protection.
- **Regression test at the right layer** — The test is at a layer where the failure mode is reproducible. A unit test for a cross-service race condition does not prevent that race.
- **Class-search performed** — The engineer documented a search for the same defect class elsewhere in the codebase, and either rolled the additional surfaces into this fix or split them into tracked follow-ups. Silent partial fixes are a finding.
- **Deployment plan reflects post-incident risk** — Rollout shape, rollback criteria, signal-watching ownership, and verification window are stated. "Merge to main, standard pipeline" is not a deployment plan for a fix that lands on a system that just had an incident.
- **Mitigation cleanup planned** — The mitigation has a stated lift criteria (signal threshold), lift procedure (exact reversal steps), and lift owner. A mitigation left in place becomes invisible debt that hides the next incident.
- **Fix does not reintroduce the incident conditions** — The fix doesn't include behavior that would reproduce the original failure mode under a slightly different input or load profile.

## Common failure modes to look for

- The mitigation promoted to permanent fix without addressing the root cause
- "Add a check" patch that addresses the specific value that triggered the incident but not the input class that contains it
- Regression test exists but is a smoke test in the general area; it passes on the pre-fix code
- "Tested locally" cited as deployment plan
- Class search done with a substring search that missed structurally similar code with different naming
- Mitigation cleanup not mentioned; the rollback or feature flag stays in place by accident
- Deployment plan implicitly relies on the mitigation staying in place, with no statement of what happens when it's lifted
- A fix that handles the failure mode for one code path but introduces the same fragility in a parallel path
