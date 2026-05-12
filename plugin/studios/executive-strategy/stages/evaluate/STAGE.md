---
name: evaluate
description: Analyze tradeoffs and model scenarios for each option
hats: [evaluator, risk-analyst, verifier]
fix_hats: [classifier, evaluator, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: options
    discovery: options-matrix
  - stage: landscape
    discovery: landscape-analysis
---

# Evaluate

Score the options the previous stage generated and stress-test them against the conditions the landscape stage described. This stage turns "here are the options" into "here is how they compare, and here is how each one breaks." The output is the input to the decision stage; if the evaluation is shallow, the decision will be too.

Units in this stage are **evaluation surfaces** — one per axis of comparison or per stress dimension (e.g. "financial returns under three market scenarios", "operational feasibility", "regulatory exposure"). The stage output `EVALUATION-REPORT.md` aggregates every unit into a comparative view.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`evaluator`** (plan) defines criteria + weights before scoring, then applies them transparently
- **`risk-analyst`** (do) stress-tests assumptions, models downside scenarios, and quantifies risk exposure
- **`verifier`** (verify) checks for criteria-after-the-fact, single-point projections without sensitivity, and bias toward a pre-chosen option

## Inputs and outputs

Consumes `options/options-matrix` and `landscape/landscape-analysis`. Produces `evaluation-report` at intent scope. The report includes: weighted multi-criteria scoring, scenario modeling under at least bull/base/bear conditions, top risks per option with probability × impact, and a comparative summary that does not pre-select a winner.

## Fix loop and gate

`fix_hats: [classifier, evaluator, feedback-assessor]` dispatches per finding. The gate is `ask` — local human approval. Decision quality depends on evaluation transparency; the user needs to inspect criteria weighting and scenario assumptions before the decision stage locks in. Project overlays may add house-style scoring scales, scenario libraries, or risk taxonomies.
