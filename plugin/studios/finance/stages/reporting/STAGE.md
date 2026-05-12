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

Package the analytical outputs of the cycle for the audiences that consume them: executives get a few decisive headlines with action, departmental leaders get their slice at line-item granularity, finance partners get the underlying data with full traceability. Each audience gets the detail level that supports its decisions — no more, no less.

The stage produces one intent-scope artifact (`FINANCIAL-REPORTS.md` under `stages/reporting/artifacts/`) plus per-unit report deliverables (narrative reports, dashboards, and required-disclosure sections).

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`reporter`** (plan) reads the variance report, budget plan, and forecast model, identifies the audience for this unit, structures the report (executive vs operational vs partner), and writes the narrative and required disclosures
- **`visualizer`** (do) designs the dashboard and visualizations that support the narrative — appropriate chart types, consistent scales, drill-down paths from summary to detail
- **`verifier`** (verify) reads the unit body and advances or rejects on substance, source traceability (every number ties back to an upstream artifact), internal consistency, and decision-register alignment

Detailed process lives in each hat's md file.

## Inputs and outputs

Upstream `analysis/variance-report`, `budget/budget-plan`, and `forecast/forecast-model` feed in. The output `financial-reports` is stakeholder-facing and feeds the `close` stage for period sign-off.

## Fix loop and gate

`fix_hats: [classifier, reporter, feedback-assessor]` dispatches per finding — classifier targets the affected report or dashboard, `reporter` re-authors the affected section (narrative or disclosure), `feedback-assessor` decides closure. The gate is `ask` because reports are stakeholder-facing — a local human reviews tone, accuracy, and disclosure completeness before close. Project overlays may add house-style report templates, branded dashboard themes, or organization-specific disclosure requirements.
