---
name: development
description: Implement the specification through code
produces: build
hats: [planner, builder, reviewer]
fix_hats: [classifier, builder, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: inception
    discovery: discovery
  - stage: design
    discovery: design-brief
  - stage: design
    discovery: design-tokens
  - stage: design
    output: design-artifacts
  - stage: product
    discovery: acceptance-criteria
  - stage: product
    discovery: behavioral-spec
  - stage: product
    discovery: data-contracts
review-agents-include:
  - stage: design
    agents: [consistency, accessibility]
  - stage: product
    agents: [completeness]
---

# Development

Turn the product stage's specification into working software: code and passing tests that satisfy the acceptance criteria and land on the project's main branch.

## Scope

Implementation against the spec — the code, the tests that prove it, and the architecture decisions that fall out along the way. Not redefining what to build (that's product), not redesigning surfaces (that's design).

## What to do

- Trace every acceptance criterion to the test and the implementation that satisfy it; leave nothing in the spec unverified.
- Build in small, verifiable increments, keeping the build and tests green as you go.
- Match the project's existing patterns and conventions rather than introducing your own.

## What NOT to do

- Don't reshape the spec to fit the code — a wrong spec is a revisit upstream, not a quiet reinterpretation here.
- Don't add scope the acceptance criteria don't call for.
- Don't advance with failing tests, failing gates, or a criterion left untested.
