---
name: analyze
description: Analyze test results and compute quality metrics
hats: [analyst, statistician, verifier]
fix_hats: [classifier, analyst, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: execute-tests
    output: test-results
  - stage: plan
    discovery: test-strategy
---

# Analyze

Turn raw test results into actionable quality insight: defect density and distribution, pass rates, defect-pattern clusters, root-cause categorization, trend analysis against baselines, and a release / defer / block recommendation. Descriptive numbers alone aren't analysis — the value is in what the data means and what to do about it.

## Scope

Interpretation of the results: patterns, root causes, statistical rigor, trends, and a defensible recommendation. Analyze decides *what the test data means*, not what happened during the run (execute-tests) or whether the product is signed off (certify).

## What to do

- Move past description to meaning — name the defect patterns, the likely root causes, and the actions they imply.
- Hold the metric math to real statistical rigor: check sample sufficiency and apply significance/trend analysis where it applies.
- Compare against historical baselines so a number reads as better, worse, or in line — not just a value in isolation.
- Make the release / defer / block recommendation explicit and tie it to the evidence behind it.

## What NOT to do

- Don't sign off on release readiness against exit criteria — that's certify's call.
- Don't re-run tests or re-author cases; gaps in the data are feedback to execute-tests or design-tests.
- Don't present raw numbers as conclusions without saying what they mean.
- Don't assert a root cause or trend the evidence doesn't support.
