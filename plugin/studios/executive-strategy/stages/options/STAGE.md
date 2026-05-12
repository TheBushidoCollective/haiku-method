---
name: options
description: Generate and structure strategic options
hats: [ideator, modeler, verifier]
fix_hats: [classifier, ideator, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: landscape
    discovery: landscape-analysis
---

# Options

Take the landscape view and produce a deliberately wide set of strategic options. The job is to expand the decision space, not to narrow it — that's the next stage's role. Skipping this widening step is the single most common failure mode in strategic decisions: the team locks onto the first plausible option, models it carefully, and never seriously considers alternatives.

Units in this stage are **option families** — each unit defines one distinct strategic direction (e.g. "build vs. partner vs. acquire", "geographic expansion variants", "pivot vs. extend"). The stage output `OPTIONS-MATRIX.md` aggregates every unit's option(s) into a comparable matrix with consistent dimensions.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`ideator`** (plan) generates the option set for this unit's strategic axis — including unconventional alternatives
- **`modeler`** (do) builds the financial and operational model for each option with explicit assumptions
- **`verifier`** (verify) checks differentiation, traceability to landscape, and decision-register consistency

## Inputs and outputs

Consumes `landscape/landscape-analysis`. Produces `options-matrix` at intent scope. Each option in the matrix carries: value proposition, theory of change, financial model (investment, returns, break-even), resource requirements, and risk/reward profile.

## Fix loop and gate

`fix_hats: [classifier, ideator, feedback-assessor]` dispatches per finding. The gate is `ask` — local human approval via the review UI, because the option set frames everything that follows; the user needs to confirm the space before evaluation begins. Project overlays may add house-style modeling conventions (currency, time-horizon defaults, sensitivity ranges) without modifying the plugin defaults.
