---
name: forecast
description: Research market conditions and develop revenue projections
hats: [analyst, forecaster, verifier]
fix_hats: [classifier, analyst, feedback-assessor]
review: ask
elaboration: collaborative
inputs: []
---

# Forecast

Develop the revenue and cost projections that anchor every downstream finance stage. This is the first stage in the studio — no inputs from prior finance stages — so its job is to ground the cycle in evidence: market signals, historical performance, leading indicators, and explicitly stated assumptions.

The stage produces one intent-scope artifact (`FORECAST-MODEL.md` under `stages/forecast/artifacts/`) plus per-unit projection workings. The model lays out base / optimistic / pessimistic scenarios with distinct driver assumptions — not a single number with a confidence interval slapped on it.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`analyst`** (plan) gathers and validates the data — market reports, internal historical actuals, named leading indicators — and writes the data foundation the forecaster will project from
- **`forecaster`** (do) builds the projection model with explicit drivers, scenario assumptions, and sensitivity tests against the analyst's foundation
- **`verifier`** (verify) reads the unit body and either advances or rejects on substance, citation, internal consistency, and decision-register alignment

Detailed process lives in each hat's md file — this stage enforces the chain, not its contents.

## Inputs and outputs

This stage has no upstream finance inputs. It MAY draw on intent-level context (strategic plan, prior-period actuals) provided through `intent.md`. The output `forecast-model` feeds `budget`, `analysis`, and `reporting`.

## Fix loop and gate

Open findings dispatch `fix_hats: [classifier, analyst, feedback-assessor]` per finding. The classifier sets targets; `analyst` re-grounds the affected projection slice in evidence; `feedback-assessor` decides closure. The gate is `ask` — a local human reviews scenario plausibility before the budget stage consumes the model. Project overlays at `.haiku/studios/finance/stages/forecast/` may add house-style conventions (specific FP&A platform output formats, internal driver naming, sensitivity matrix templates) without modifying the plugin defaults.
