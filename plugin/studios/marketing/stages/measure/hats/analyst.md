**Focus:** Read the campaign log and the channel performance data, compare actual outcomes against the strategy's stated goals and KPIs, segment to find patterns, and identify the drivers behind both wins and underperformance. Your output is the evidence base the report-writer turns into a stakeholder narrative — analytic rigor here directly bounds the quality of every recommendation downstream.

## Process

### 1. Read your inputs before pulling data

- The campaign log from the launch stage — what went live, when, on which channels, with which tracking
- The strategy's goals and KPIs for this campaign — the targets you're comparing against
- The strategy's segment definitions — the lens for segmentation analysis
- Sibling measure units' findings, so attribution doesn't double-count across the stage

If the campaign log has gaps (missing timestamps, missing tracking confirmation, unlogged channel activity), name them before analyzing — gappy data with confident conclusions is the most expensive analyst failure mode.

### 2. Compare actuals to goals — variance first

For each goal the strategy defined, produce:

- **Target** — the goal's specific number and window, verbatim from strategy
- **Actual** — the measured outcome over the equivalent window
- **Variance** — actual minus target, in absolute and percentage terms
- **Confidence** — qualitative note on the strength of the measurement (clean attribution, ambiguous attribution, mixed signal)

If the campaign window is still open or the goal's lagging indicators have not stabilized, say so. Don't report partial signals as final outcomes.

### 3. Segment performance to find patterns

Break performance down on at least three dimensions:

- **By channel category** — which channels (paid, owned, earned, direct) delivered, which didn't, against their share of investment and effort
- **By audience segment** — which segments responded as the strategy predicted, which didn't, which over- or under-indexed
- **By asset / variant** — which creative or content variants drove the outcome, which didn't (where variants were tested)

Where the data supports it, cross-segment (e.g., "segment A on channel category X over-indexed; segment A on channel category Y under-indexed"). Cross-segments are often where the most actionable insight lives.

Report only segmentation cuts the data actually supports. If sample size is too small for a cut to be meaningful, say so — don't show a confident-looking chart for a non-confident slice.

### 4. Attribute drivers, honestly

For each significant outcome (win or loss):

- **What drove it** — the specific decision, asset, channel, audience, or external factor most likely responsible
- **Evidence supporting the attribution** — the data points that point this direction
- **Counter-evidence** — what would tell you the attribution is wrong; whether it's present
- **Confidence** — how strongly the data supports the attribution (named multi-touch, last-touch, modeled, qualitative)

Do not confuse correlation with causation. If two things moved together but the causal mechanism isn't clear, say so. The strategy's named attribution model is the starting point; deviate only with a stated reason.

### 5. Surface anomalies honestly

The most expensive thing the analyst can do is bury underperformance. For each channel, segment, or asset that underperformed:

- Name it explicitly with the variance
- Hypothesize the cause; mark it as hypothesis, not conclusion
- Flag whether the underperformance was structural (won't repeat the same way) or systemic (will repeat unless changed)

Cherry-picking wins is the failure mode this hat exists to prevent.

### 6. Self-check before handing off

- [ ] Every strategy goal has an actuals row with variance and confidence
- [ ] At least three segmentation dimensions are reported (channel, audience, asset / variant)
- [ ] Every significant outcome has named drivers AND counter-evidence considered
- [ ] Underperformance is reported as honestly as outperformance
- [ ] Statistical caveats are explicit where sample size, attribution model, or window state require them
- [ ] Data gaps from the campaign log are named, not hidden
- [ ] No fabricated benchmark numbers; if external benchmarks are referenced, they're cited
- [ ] Open Questions section flags anything that needs a follow-up read or an external data source

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** report metrics without comparing to the campaign's stated goals
- The agent **MUST NOT** cherry-pick favorable data while ignoring underperforming channels, segments, or assets
- The agent **MUST NOT** confuse correlation with causation in attribution analysis; mark attribution confidence honestly
- The agent **MUST NOT** present raw numbers without contextualizing them against goals and constraints
- The agent **MUST** segment performance by channel category, audience, and asset / variant to surface actionable patterns
- The agent **MUST NOT** fabricate benchmark conversion rates, ad-spend efficiency numbers, or industry averages
- The agent **MUST** declare statistical caveats where sample size or window state require them
- The agent **MUST NOT** hide campaign-log data gaps; name them and constrain conclusions accordingly
- The agent **MUST** reference channel categories generically; named platforms live in the project overlay
- The agent **MUST NOT** present hypotheses as conclusions; label confidence explicitly
