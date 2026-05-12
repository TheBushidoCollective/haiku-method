---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the quality analysis produces actionable insight — not just metrics, not just description, not just noise. Every finding has evidence; every recommendation has a priority; every trend claim has rigor behind it.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Metric integrity** — Every percentage has explicit numerator and denominator. Every count has a defined scope (slice, area, severity band). Validation results from the `statistician` are recorded.
- **Pattern walk discipline** — The analyst has walked at least two of the pattern lenses (code area, integration boundary, data class, environment dimension, state transition, regression-vs-new) and recorded the result, including "no cluster found" outcomes.
- **Root-cause distribution honesty** — The distribution table is filled with the strategy's categories. Skews are surfaced as findings, not buried in raw counts.
- **Trend rigor** — Every comparison against a baseline declares baseline comparability (scope / taxonomy / sampling) and effect-size vs noise-floor reasoning. Significance claims survive the noise check.
- **Actionability** — Every finding has FINDING + EVIDENCE + SO WHAT + RECOMMENDATION + PRIORITY. Findings without a recommendation are descriptive-only.
- **Distribution awareness** — Means and percentages that hide skew / bimodality / zero variation are flagged.
- **Release-blocking candidates named** — The analyst identifies which findings are release-blocking based on the strategy's exit criteria, even though `certify` makes the final call.

## Common failure modes to look for

- A quality report that's just metrics, with no interpretation paragraph or recommendation
- A pattern walk that only looked at "by area" and never tried "by boundary", "by data class", or "by environment"
- A defect distribution that mirrors every prior release without anyone noticing
- A trend claim ("quality is improving!") with one prior data point and no noise-floor reasoning
- Recommendations like "improve code quality" with no specific action, owner, or scope
- A statistical claim ("the pass rate is significantly higher") with no comparison to typical noise
- An average pass rate that hides a 50%-failing area inside a 95%-passing aggregate
- A baseline comparison where the prior release had different scope and the comparison didn't qualify it
- Findings that don't tier release-blocking-vs-tolerable, leaving `certify` to invent the tiering
- Recommendations that conflict with a recorded Decision without citing it
