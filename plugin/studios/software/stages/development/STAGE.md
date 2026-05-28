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

Turn the upstream specification into working software: code and passing tests that satisfy the work's completion criteria and land on the project's main branch. For an application that ran the product and design stages, that spec is their acceptance criteria, contracts, and design artifacts; for a library or CLI that dropped them, it's the unit's own completion criteria plus the inception knowledge — read whatever upstream inputs the dispatch actually resolved.

## Scope

Implementation against the spec — the code, the tests that prove it, and the architecture decisions that fall out along the way. Not redefining what to build (that's the product stage, where it ran), not redesigning surfaces (that's design, where it ran).

## What to do

- Trace every acceptance criterion to the test and the implementation that satisfy it; leave nothing in the spec unverified.
- Build in small, verifiable increments, keeping the build and tests green as you go.
- Match the project's existing patterns and conventions rather than introducing your own.

## What NOT to do

- Don't reshape the spec to fit the code — a wrong spec is a revisit upstream, not a quiet reinterpretation here.
- Don't add scope the acceptance criteria don't call for.
- Don't advance with failing tests, failing gates, or a criterion left untested.
