---
name: measure
description: Track KPIs, analyze performance, and generate insights and recommendations
hats: [analyst, report-writer, verifier]
fix_hats: [classifier, analyst, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: launch
    discovery: campaign-log
---

# Measure

Close the loop on the campaign: read what actually happened from the launch log and the channel platforms, compare it against the goals strategy defined, attribute outcomes to specific decisions, and produce recommendations the next campaign can act on. This stage exists to make the next campaign better than this one.

## Scope

Performance analysis and recommendations. Measure decides *what the results were, why, and what to do differently next time* — not the live activation it grades (launch) or the goals it grades against (strategy). Units are measurement surfaces (channel, segment, asset, overall-vs-goal); they may share data but produce distinct analytic lenses.

## What to do

- Pull performance data per channel, segment, and asset, and compare actual KPIs to the strategy's targets using the strategy's own definitions.
- State the attribution model explicitly and segment the data to find the patterns that explain the result.
- Be honest about statistical caveats and the limits of what the data can support.
- Tie every recommendation to a specific finding so the next campaign can act on evidence, not opinion.

## What NOT to do

- Don't redefine the KPIs to flatter the result — measure against the strategy's definitions as written.
- Don't relaunch, re-author assets, or change live channels; measure analyzes, it doesn't operate.
- Don't claim attribution the data can't support, or bury the caveats.
- Don't produce recommendations that float free of a finding.
