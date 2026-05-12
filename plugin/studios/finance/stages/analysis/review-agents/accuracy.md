---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the variance report's numbers are right, its classifications fit the evidence, and its corrective actions are specific enough to act on. A variance report that fails this lens drives the wrong corrective action — operational fixes applied to structural problems, or vice versa — and downstream conversations cite numbers that can't be defended.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Mathematical correctness** — dollar variance, percentage variance, and direction (favorable / unfavorable) calculate correctly from the underlying actuals and benchmark. Random spot-checks against source data tie within rounding.
- **Methodology consistency** — granularity, comparison basis (budget vs. forecast vs. prior period), period definition, and materiality threshold are stated up front and applied uniformly throughout the report. Different materiality thresholds for different departments in the same report is a finding.
- **Classification fit** — each material variance's classification (structural / timing / operational) is consistent with its cited evidence. Permanent business-shape changes classified as operational, or self-correcting phasing classified as structural, are misfits that lead to wrong corrective action.
- **Evidence-backed attribution** — every root-cause attribution cites specific evidence (an operational system report, a dated stakeholder conversation, a documented incident or decision). "Industry common knowledge", "team feedback", or "trend" without backing are findings.
- **Actionable corrective recommendations** — every material unfavorable operational variance has a recommended action naming owner, action, and timing. "Improve win rate" is not actionable; "Sales ops to launch a discount-policy review by end of next month" is.
- **Multi-period context** — material lines include the prior two periods' variance to distinguish noise from trend. A line adverse for three consecutive periods is a structural finding, not three operational ones.

## Common failure modes to look for

- A variance classified operational when the evidence indicates a permanent market or customer-mix shift (structural)
- Favorable variances ignored — large favorables often signal budget padding, scope miss, or a leading indicator of an upcoming problem
- Root-cause attribution that's actually a restatement of the variance ("revenue is down because sales fell")
- A corrective action with no owner or timing — non-actionable
- A report that silently switches comparison basis (budget-vs-actual one section, forecast-vs-actual the next) without labeling
