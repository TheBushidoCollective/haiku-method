---
name: reporting
description: Create financial reports and dashboards for stakeholders
hats: [reporter, visualizer, verifier]
fix_hats: [classifier, reporter, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: analysis
    discovery: variance-report
  - stage: budget
    discovery: budget-plan
  - stage: forecast
    discovery: forecast-model
---

# Reporting

Package the cycle's analytical outputs for the audiences that consume them. Executives get a few decisive headlines with action, departmental leaders get their slice at line-item granularity, finance partners get the underlying data with full traceability. This is where the numbers become a story each audience can act on.

## Scope

Communication of existing analysis: narratives, dashboards, and disclosures tailored per audience, each at the detail level that supports its decisions. Reporting decides *how the cycle's results are presented and to whom* — not the analysis itself, which the upstream stages already produced.

## What to do

- Match each report's depth and framing to its audience — no more detail than that audience's decisions require, no less.
- Trace every number back to an upstream artifact so the report is verifiable, not just plausible.
- Pair the narrative with visualizations that genuinely support it — right chart type, consistent scales, a path from summary to detail.
- Cover required disclosures completely and in the right place.

## What NOT to do

- Don't perform new analysis or recompute variances — consume the analysis stage's output; a gap there is a revisit upstream.
- Don't show a number you can't trace to its source.
- Don't over-disclose to one audience or under-disclose to another to make a report look cleaner.
- Don't let visual polish paper over a tone or accuracy problem a human should catch.
