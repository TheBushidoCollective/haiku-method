---
interpretation: lens
---
**Mandate:** The agent **MUST** verify validation testing actually covered every functional requirement and every hazard from the safety analysis. Coverage is the lens — products that pass "validation" with implicit holes ship those holes to field, where the unexercised requirements become the warranty claims and the unexercised hazards become the recalls.

## Check

The agent **MUST** verify, filing feedback for any violation:

1. The agent **MUST** verify that every functional requirement has at least one validation test with a documented pass result, and that the requirement-to-test trace matrix is current with the requirement set as it ships.
2. The agent **MUST** verify that every hazard from the safety analysis has a validation test that exercises the fail-safe behavior under the documented stimulus — happy-path tests do not validate a hazard.
3. The agent **MUST** verify that environmental testing covered the full specified operating envelope (temperature, humidity, vibration, shock, EMC, ESD) — partial-envelope testing is a coverage gap.
4. The agent **MUST** verify that lifecycle / endurance tests ran to the spec'd duration or cycle count, not just "enough to fit the schedule".
5. The agent **MUST** verify that variants (SKUs, regional configurations, color / material options that affect thermal or mechanical behavior) each have validation evidence, or a documented rationale for why one variant's data covers another.
6. The agent **MUST** verify that test failures during validation were dispositioned — fixed (with re-test passing), accepted as known limitation (with rationale), or deferred (with timing) — not silently ignored.
7. The agent **MUST** verify that test reports include sample sizes and pass criteria; a "passed" line with no N and no criterion is not validation.

## Common failure modes to look for

- A functional requirement that has no test linked because it was added late and the matrix wasn't refreshed
- A hazard "validated" by reasoning rather than by an actual fail-safe activation test
- Environmental testing run at room temperature because the chamber was booked
- An endurance test stopped early at the project manager's request, reported as "passed"
- A new color variant assumed to have the same thermal profile as the baseline, with no actual data
- A failed test the team "decided was a fluke" with no failure-analysis documentation
