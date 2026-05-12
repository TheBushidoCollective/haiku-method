---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the measurement methodology is sound and the conclusions are warranted — KPIs match the strategy's definitions, the attribution model is stated and appropriate, statistical caveats are honest, and recommendations trace to specific findings. Methodology gaps here become next-campaign mistakes dressed up as data-backed decisions.

## Check

The agent **MUST** verify, file feedback for any violation:

- **KPI fidelity to strategy** — Every KPI reported matches the strategy stage's KPI definitions. KPIs silently redefined ("we said unaided recall, the report shows aided recall"), or new KPIs introduced without flagging the change, are findings.
- **Attribution model stated and appropriate** — The attribution model used (named: multi-touch, last-touch, first-touch, modeled, qualitative) is explicit AND appropriate for the channel mix the campaign ran. Last-touch attribution on a campaign that leans on awareness channels is a finding; multi-touch attribution claimed without naming the touch-weighting is a finding.
- **Statistical caveats honest** — Where sample size, window state, or attribution confidence limit what the data can claim, the limit is stated. Confident conclusions drawn from underpowered slices, ongoing campaigns reported as final, or single-source attribution claims presented without caveat are findings.
- **Recommendation traceability** — Every recommendation cites a specific finding from the analyst's data. Generic best-practice recommendations ("test more variants", "increase budget") not tied to this campaign's data are findings. Recommendations that assume causation where only correlation was demonstrated are findings.
- **Underperformance surfaced** — Underperformance by channel, segment, or asset is reported as plainly as outperformance. A report that frames every result as a win is a finding (cherry-picking is the failure mode this lens exists to prevent).
- **Data-gap disclosure** — Gaps in the campaign log (missing timestamps, missing tracking confirmations, unlogged anomalies) that constrain what the analysis can conclude are named. Gaps treated as if they didn't exist are findings.
- **No fabricated benchmarks** — Industry benchmarks, projected impact figures, and "typical conversion rate" claims are either cited to a real source or stated as ordinal language (small / meaningful / large). Invented benchmark numbers are findings.

## Common failure modes to look for

- A KPI in the report that doesn't appear in the strategy's KPI definitions
- An attribution claim with no named model
- A confident conclusion drawn from a segment cut whose sample size makes the cut non-meaningful
- A recommendation ("increase budget on channel X") presented without the underlying finding that supports it
- A "neutral" finding section that quietly omits the worst-performing channel
- A projected-impact figure given as a specific number with no derivation shown
- An ongoing campaign reported as if the lagging indicators have stabilized when they haven't
