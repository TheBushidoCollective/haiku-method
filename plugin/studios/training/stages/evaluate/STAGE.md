---
name: evaluate
description: Measure training effectiveness and analyze feedback
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

Measure whether the training actually moved the needle on the gap that needs-analysis identified. Cover multiple Kirkpatrick levels (reaction, learning, behavior, results), produce statistically defensible findings, and generate improvement recommendations the next program iteration consumes.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`evaluator`** (plan / do) designs the evaluation for one outcome area — chooses the Kirkpatrick levels appropriate to the question, designs the instruments (pre/post assessments, surveys, observation rubrics, behavior-on-the-job measures), collects the data
- **`analyst`** (do — interpretation) validates data quality, runs the analysis (significance, effect size, cohort comparisons), checks confounders, maps outcomes back to the original needs-analysis gap, drafts improvement recommendations
- **`verifier`** (verify) validates the finding artifact for substance, citation, and internal consistency — advances or rejects to the responsible hat

The detailed process for each role lives in the hat's md file. This stage's job is to enforce the chain.

## Inputs and outputs

Reads `deliver/delivery-log`, `needs-analysis/needs-assessment`, and `design/curriculum-plan` for every unit. Output is `EFFECTIVENESS-REPORT.md` per unit — findings on one outcome area with evidence, analysis, and prioritized recommendations.

## Fix loop and gate

Review feedback dispatches the `fix_hats: [classifier, evaluator, feedback-assessor]` chain. Gate is `ask` — the user approves the evaluation findings locally before they feed back into the next program iteration, because incorrect causal claims here distort every downstream decision. Project overlays at `.haiku/studios/training/stages/evaluate/` may add house conventions (organization-specific KPI taxonomy, named survey platform, statistical-significance threshold, ROI calculation method) without modifying the plugin defaults.
