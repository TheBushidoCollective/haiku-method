---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify the assessment covers every in-scope control with substantive evidence and that gap identification is comprehensive. Coverage gaps here are how known weaknesses survive to the external audit — partial assessment is not assessment.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Universal control coverage** — every applicable + bound (control, system) pair from `CONTROL-MAPPING.md` has a corresponding finding row in `GAP-REPORT.md`. No row is silently skipped.
- **Evidence-based gap identification** — gaps are named from observed evidence (or observed absence of evidence), not from assumption, intuition, or prior-cycle carryover.
- **Risk-rating justification** — every risk score (likelihood + impact + residual) has a rationale grounded in specific findings: threat surface, exposure window, data classification, compensating-control effect.
- **Severity honesty** — material gaps (controls affecting `restricted` data classes, controls covering perimeter, controls satisfying multiple frameworks) are not minimized to keep the report short. Severity reflects observed risk, not political preference.
- **Per-control depth proportional to risk** — easy / low-risk controls get a short, evidenced row; high-risk / partially-met controls get a deeper analysis with deficiency detail sufficient for remediation planning.
- **Dependencies surfaced** — where one gap blocks another (e.g., identity unification blocks per-user audit logging), the dependency is named in the prioritized list. Hidden dependencies break the remediate-stage plan.
- **Multi-framework controls assessed once** — controls that appear in multiple frameworks (per the scope mapping's overlap notes) are evaluated and cited once; not re-evaluated independently with different conclusions.

## Common failure modes to look for

- A "summary table only" assessment where individual controls don't appear in the body — the auditor will sample, and unsampled controls have no evidence
- Risk scores assigned without rationale, or with rationale that doesn't justify the score (`high` with rationale "this is important")
- Material gaps softened to `medium` because the team is uncomfortable owning them
- Compensating controls credited generously to reduce gap counts without per-control evidence the compensating control actually applies
- A `partially met` rating with no deficiency description — partial without specifics is unactionable
- Open questions left unanswered in the assessment (e.g., "TBD: confirm Q3 access-review evidence") that quietly become findings the certify stage cannot close
- Gaps without dependencies surfaced, so the remediate stage discovers mid-execution that prerequisite work was never planned
- The same control evaluated separately for two frameworks with different conclusions, indicating the assessor did not check overlap
