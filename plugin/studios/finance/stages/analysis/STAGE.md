---
name: analysis
description: Perform variance analysis and track financial performance
hats: [analyst, auditor, verifier]
fix_hats: [classifier, analyst, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: budget
    discovery: budget-plan
  - stage: forecast
    discovery: forecast-model
---

# Analysis

The diagnostic stage of the finance cycle: explain the gap between what was planned and what actually happened. Budget said what was supposed to happen, forecast said what was projected, actuals reveal what occurred — analysis says why they differ and what to do about it.

## Scope

Variance diagnosis: comparing actuals against budget and forecast, classifying each material variance, and recommending corrective action. Analysis decides *why the gap exists and how to respond* — not what the targets should have been (budget), and not how the findings reach stakeholders (reporting).

## What to do

- Classify each material variance by cause — structural, timing, or operational — not just by size.
- Tie every variance back to its data source so the attribution is auditable, not asserted.
- Translate the variance landscape into specific corrective-action recommendations, not just a table of deltas.
- Apply a consistent materiality threshold so attention lands where it changes a decision.

## What NOT to do

- Don't reset targets or reallocate the budget — surface the recommendation; the actual change is a revisit to budget.
- Don't reproject the forecast to make a variance disappear.
- Don't package findings for stakeholders or build dashboards — that's reporting.
- Don't report a variance you can't trace to its source.
