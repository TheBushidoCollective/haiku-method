---
name: health-check
description: Monitor account health, identify risks, and create action plans
hats: [health-monitor, risk-analyst, verifier]
fix_hats: [classifier, health-monitor, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: adoption
    discovery: usage-report
---

# Health Check

Read account health across multiple dimensions and convert that read into ranked risks with concrete mitigation plans. This stage is the lifecycle's early-warning system — it tells the studio which accounts are healthy enough to grow and which need intervention before renewal is at stake.

## Scope

Scoring health on evidence, separating leading from lagging churn signals, and producing a ranked mitigation plan. Health-check decides *where each account stands and what to do about the risks* — it does not grow product usage (adoption) or qualify expansion opportunities (expansion).

## What to do

- Rate each health dimension against explicit evidence, and show the trend versus the prior period.
- Pull external signals — support volume, sentiment, stakeholder access — alongside usage, not in place of it.
- Separate leading indicators from lagging ones, and rank risks by severity and reversibility.
- Give every mitigation an owner and a measurable success criterion.

## What NOT to do

- Don't design or run adoption plays — that's the adoption stage.
- Don't qualify or pursue expansion opportunities — that's expansion.
- Don't rate a dimension without the evidence behind the rating.
- Don't surface a risk without a concrete, owned mitigation.
