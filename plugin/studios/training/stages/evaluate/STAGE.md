---
name: evaluate
description: Measure training effectiveness and analyze feedback
optional: true
hats: [evaluator, analyst, verifier]
fix_hats: [classifier, evaluator, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: deliver
    discovery: delivery-log
  - stage: needs-analysis
    discovery: needs-assessment
  - stage: design
    discovery: curriculum-plan
---

# Evaluate

The closing stage of the training lifecycle: measure whether the program actually moved the needle on the gap needs-analysis identified. Work across Kirkpatrick levels (reaction, learning, behavior, results), produce statistically defensible findings, and generate the improvement recommendations the next iteration consumes.

## Scope

Effectiveness measurement and analysis: choosing the right Kirkpatrick levels, designing instruments (pre/post assessments, surveys, observation rubrics, on-the-job measures), collecting and analyzing the data, and mapping outcomes back to the original gap. Evaluate decides *whether the program worked and what to change* — not how it ran (deliver) or what was built (develop).

## What to do

- Pick the Kirkpatrick levels that actually answer the outcome question, not just the easy-to-measure ones.
- Design instruments and collect data rigorously enough that the findings are defensible.
- Run the analysis honestly — significance, effect size, cohort comparison, confounders — and tie outcomes back to the needs-analysis gap.
- Turn findings into prioritized recommendations the next iteration can act on.

## What NOT to do

- Don't fix materials or re-run delivery — improvements land as recommendations for the next iteration.
- Don't claim causation the data doesn't support; a wrong causal claim distorts every downstream decision.
- Don't measure reaction alone and call the program effective.
- Don't ship findings without the evidence and analysis that back them.
