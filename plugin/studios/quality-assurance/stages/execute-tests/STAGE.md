---
name: execute-tests
description: Execute tests and log defects
hats: [tester, reporter, verifier]
fix_hats: [classifier, tester, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: design-tests
    discovery: test-suite-spec
  - stage: plan
    discovery: test-strategy
---

# Execute Tests

Run the designed test suite against the planned environment, capture evidence, and log defects — producing the test-results record that analyze and certify depend on. Execution discipline here is what makes the downstream data trustworthy.

## Scope

Test execution and evidence: running cases at the planned environment fidelity, recording each result with proof, and writing accurate defect reports. Execute-tests decides *what actually happened when the tests ran*, not what the tests are (design-tests) or what the results imply (analyze).

## What to do

- Confirm the environment matches the planned fidelity before running anything — results from the wrong environment are noise.
- Capture concrete evidence for every result, pass or fail, so the record stands on its own.
- Write defect reports with enough reproduction detail and accurate severity that someone else could confirm them.
- Flag blocked or unexecutable cases explicitly rather than silently skipping them.

## What NOT to do

- Don't redesign or reinterpret cases mid-run to make them pass — a wrong case is feedback to design-tests.
- Don't analyze trends, compute quality verdicts, or recommend release/defer/block — that's analyze.
- Don't record a result without the evidence that backs it.
- Don't leave a case's outcome unrecorded or its blocked status unexplained.
