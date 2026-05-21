---
name: design-tests
description: Design test cases and plan automation
hats: [designer, automator, verifier]
fix_hats: [classifier, designer, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: plan
    discovery: test-strategy
---

# Design Tests

Turn the test strategy into executable test artifacts: explicit test cases, a traceability matrix back to requirements, and an assessment of which cases to automate. This is where the strategy's intent becomes something a tester or a framework can actually run.

## Scope

Test design and automation strategy — case definition (preconditions, steps, expected results), requirement traceability, and automation feasibility. Design-tests decides *what the tests are*, not what to test (that's plan), whether they pass (execute-tests), or what failures mean (analyze).

## What to do

- Trace every test case back to a requirement or quality dimension the strategy named — leave no case unanchored and no in-scope requirement uncovered.
- Apply real design techniques (boundary, equivalence partition, decision table, state transition) rather than happy-path-only cases.
- Decide which cases automate and which stay manual, and justify each call against cost and stability.
- Write cases precise enough that someone other than the author could run them and get the same result.

## What NOT to do

- Don't redefine scope or risk priority — that's a revisit to plan, not a quiet reinterpretation here.
- Don't execute the cases or capture results; designing and running are separate stages.
- Don't leave a strategy-named area without coverage.
- Don't write cases whose expected result is ambiguous or unverifiable.
