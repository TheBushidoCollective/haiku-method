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

Close the loop on the campaign: read what actually happened from the launch log and the channel platforms, compare against the goals defined in strategy, attribute outcomes to specific decisions, and produce recommendations the next campaign can act on. This stage exists to make the next campaign better than this one.

## Per-unit baton

Each measure unit walks the three hats in `plan → do → verify` order:

- **`analyst`** (plan + do) — pulls performance data per channel / segment / asset, compares actual KPIs to strategy targets, segments to find patterns, attributes drivers
- **`report-writer`** (do — synthesis) — turns the analyst's findings into a narrative report with prioritized recommendations
- **`verifier`** (verify) — confirms KPIs match the strategy's definitions, the attribution model is stated, statistical caveats are honest, and recommendations trace to specific findings

A unit here is one measurement surface (e.g. "channel performance", "segment performance", "asset performance", "overall vs. goal"). Units may share input data but produce distinct analytic lenses.

## Inputs and outputs

Consumes `launch/campaign-log` (what went live, when, with which tracking). Produces a performance report and a recommendation set that feeds the studio's reflection and the next campaign's research stage.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, analyst, feedback-assessor]` dispatches per finding. The gate is `auto` — measurement is a knowledge artifact, not a customer-facing publication; the reflection step is where humans engage with the conclusions.
