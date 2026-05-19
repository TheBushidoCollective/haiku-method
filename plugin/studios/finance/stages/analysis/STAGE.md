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

Compare actuals to budget and forecast, classify each material variance, and translate the resulting variance landscape into corrective-action recommendations. This is the diagnostic stage of the lifecycle: budget says what was supposed to happen, forecast says what was projected, actuals reveal what actually happened, and analysis explains the gap.

The stage produces one intent-scope artifact (`VARIANCE-REPORT.md` under `stages/analysis/artifacts/`) plus per-unit variance workings.

## Per-unit baton

- `analyst` → `auditor`: variance table with classification (structural / timing / operational), evidence, and recommended corrective action per material variance.
- `auditor` → `verifier`: data-source-confirmed variance table (methodology validated or findings filed against attributions).

## Inputs and outputs

Upstream `budget/budget-plan` and `forecast/forecast-model` feed in. The output `variance-report` feeds `reporting` (stakeholder communication) and `close` (period sign-off context).

## Fix loop and gate

`fix_hats: [classifier, analyst, feedback-assessor]` dispatches per finding — classifier targets the affected variance, `analyst` re-runs the calculation or re-attributes the root cause, `feedback-assessor` decides closure. The gate is `auto` because the substantive review happens at the next stage (`reporting`) where the variance report becomes stakeholder-facing. Project overlays may add house-style variance categorization, materiality threshold tables, or organization-specific dimension hierarchies.
