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

Score the options the previous stage generated and stress-test them against the conditions the landscape described. This stage turns "here are the options" into "here is how they compare, and here is how each one breaks." Its output is the input to the decision; a shallow evaluation produces a shallow decision.

## Scope

Defining comparison criteria, scoring each option transparently, and modeling how each one behaves under stress. Evaluate decides *how the options compare and where they're fragile* — it does not generate the options (options) or select and ratify one (decide). It must not pre-select a winner.

## What to do

- Define criteria and weights before scoring, then apply them transparently to every option.
- Stress-test assumptions and model downside scenarios under at least bull, base, and bear conditions.
- Quantify the top risks per option with probability and impact.
- Produce a comparative summary that lays out tradeoffs without naming a winner.

## What NOT to do

- Don't generate new options or reshape the option set — that's the options stage.
- Don't make the recommendation — that's the decide stage.
- Don't define criteria after seeing the scores, or project a single point without sensitivity.
- Don't let a pre-chosen option bias the weighting or the scenarios.
