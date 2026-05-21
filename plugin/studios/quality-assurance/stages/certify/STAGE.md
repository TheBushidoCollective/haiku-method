---
name: certify
description: Quality sign-off and release readiness assessment
hats: [certifier, reviewer, verifier]
fix_hats: [classifier, certifier, feedback-assessor]
review: external
elaboration: autonomous
inputs:
  - stage: analyze
    discovery: quality-report
  - stage: execute-tests
    output: test-results
  - stage: plan
    discovery: test-strategy
---

# Certify

The closing stage of the QA lifecycle: sign off on quality and release readiness against the strategy's exit criteria. This produces the certification record — every exit criterion evaluated with evidence, every unresolved defect listed with its risk-acceptance status, and the release / defer / block determination with audit-clean rationale.

## Scope

Release-readiness sign-off: evaluating each exit criterion against the evidence, accounting for known issues, and recording a determination an authority can stand behind. Certify decides *whether to ship*, not what the data means (analyze) or what happened in the run (execute-tests).

## What to do

- Evaluate every exit criterion the strategy set, each backed by cited evidence rather than assertion.
- List every unresolved defect with an explicit risk-acceptance status — nothing shipped on silence.
- State the release / defer / block determination with rationale that would survive an audit.
- Pull the supporting evidence from the analyze and execute-tests records rather than re-deriving it.

## What NOT to do

- Don't re-run the analysis or re-interpret results — consume what analyze produced; dispute it as feedback if it's wrong.
- Don't waive an exit criterion without recording the risk acceptance.
- Don't ship a determination whose rationale a reviewer couldn't trace to evidence.
- Don't leave an unresolved defect off the record.
