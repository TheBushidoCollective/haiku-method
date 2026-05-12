---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that every status determination in `GAP-REPORT.md` accurately reflects the current state of the bound systems. Inaccurate findings mislead the remediate stage into fixing the wrong things and the certify stage into evidencing claims the auditor will challenge.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Evidence currency** — every cited piece of evidence is recent enough to reflect the system's current state. Stale exports from a prior cycle (more than the audit-period boundary away) are not evidence of the current state.
- **Evidence specificity** — every status determination cites concrete artifacts (file path, command output, dated stakeholder confirmation), not "verified by inspection" or "team confirmed".
- **Met vs effective** — controls marked `met` have evidence of *operating effectiveness*, not just *existence*. A documented policy nobody follows is unmet. A monitoring alert that's been firing-and-ignored is unmet.
- **Status vs evidence alignment** — the status label matches the evidence presented. A control with named deficiencies cannot be `met`; a control with no deficiencies cannot be `partially met`.
- **Compensating-control attribution** — where compensating controls are credited, they are described and their effect on the original control's gap is named. Vague "we have other safeguards" credit is not evidence.
- **Inherited-control attribution** — inherited controls (third-party SOC 2, cloud-provider attestations) cite the specific inheritance artifact and confirm it covers the relevant period.
- **Per-system honesty** — when a control is met on system A but unmet on system B, both are recorded separately. Aggregating across systems hides per-system gaps the auditor will sample.

## Common failure modes to look for

- A `met` determination citing only a stakeholder verbal confirmation ("the lead said it's done")
- Evidence dated from a prior assessment cycle without re-verification
- A documented policy treated as evidence the policy is operating (the policy is necessary; it is not sufficient)
- A control evaluated on production but quietly extrapolated to staging or to other production accounts without independent evidence
- Compensating controls used to upgrade an `unmet` to `partially met` without the compensating control itself being assessed and evidenced
- An exception process invoked to justify a `met` status without the exception record being reviewed and counted
- A finding worded as `partially met` to soften the politics when the evidence supports `unmet`
- Inherited controls claimed for a service-provider attestation that doesn't cover the relevant audit period
