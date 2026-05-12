---
name: analysis
description: Perform variance analysis and track financial performance
hats: [analyst, auditor]
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

Each unit walks the two hats in `plan/do → verify` order:

- **`analyst`** (plan + do) reads the upstream budget plan and forecast model, pulls actuals, calculates variances at the appropriate granularity, classifies each material variance as structural / timing / operational, and writes the supporting evidence and recommended corrective action
- **`auditor`** (verify) cross-checks the data sources, validates methodology consistency, confirms root-cause attributions are evidence-backed (not assumption-backed), and advances or rejects

Detailed process lives in each hat's md file.

## Inputs and outputs

Upstream `budget/budget-plan` and `forecast/forecast-model` feed in. The output `variance-report` feeds `reporting` (stakeholder communication) and `close` (period sign-off context).

## Fix loop and gate

`fix_hats: [classifier, analyst, feedback-assessor]` dispatches per finding — classifier targets the affected variance, `analyst` re-runs the calculation or re-attributes the root cause, `feedback-assessor` decides closure. The gate is `auto` because the substantive review happens at the next stage (`reporting`) where the variance report becomes stakeholder-facing. Project overlays may add house-style variance categorization, materiality threshold tables, or organization-specific dimension hierarchies.
