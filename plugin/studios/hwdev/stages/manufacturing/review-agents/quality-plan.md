---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the production quality plan will catch defects in-line before they ship to customers. Quality plan is the lens — a manufacturing run with weak sampling, ambiguous accept / reject criteria, or no escalation path becomes a field-failure problem six months after ramp.

## Check

The agent **MUST** verify, filing feedback for any violation:

1. The agent **MUST** verify that functional test at end-of-line exercises every requirement on every unit, with the test program version controlled and the test fixtures calibrated.
2. The agent **MUST** verify that the sampling plan names the AQL / sample size / acceptance number per inspection point and that the math is defensible (cite the standard — ANSI/ASQ Z1.4, ISO 2859, or the explicit custom rationale).
3. The agent **MUST** verify that accept / reject criteria are quantitative (measurements with tolerances) or carry calibrated visual references — "looks clean" is not a criterion.
4. The agent **MUST** verify that defect escalation procedures name who is notified at what defect rate, the line-stop authority, the disposition flow for non-conforming units, and the customer-notification trigger for escaped defects.
5. The agent **MUST** verify that every test station logs results to a system that supports yield / Pareto analysis, not just a green / red light on the operator's screen.
6. The agent **MUST** verify that any safety-critical code path or hazard from the firmware safety analysis has a corresponding functional test at the production line — silent omission becomes the recall scenario.
7. The agent **MUST** verify that the quality plan names re-test rules (how many retries are allowed, what counts as a "test failure" vs. "fixture failure") so operators don't game pass rates by re-running until pass.

## Common failure modes to look for

- A sampling plan that lifts an AQL value from another product without checking the criticality classification
- "Visual inspection — clean, no defects" with no exemplar photos and no measurable tolerances
- Defect escalation that says "notify quality team" with no named role and no defect-rate trigger
- A test station that logs pass / fail with no per-test-step result, blocking any Pareto analysis when yield drops
- A safety-critical firmware path with no production-line test, on the assumption it was validated upstream
- Re-test rules undocumented, leaving operators free to run a marginal unit five times to get a pass
