---
name: product
description: Define behavioral specifications and acceptance criteria
optional: true
hats: [product, specification, validator]
fix_hats: [classifier, product, specification, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: inception
    discovery: discovery
  - stage: design
    discovery: design-brief
  - stage: design
    discovery: design-tokens
outputs:
  - discovery: acceptance-criteria
    hat: product
  - discovery: behavioral-spec
    hat: specification
  - discovery: data-contracts
    hat: specification
  - discovery: coverage-mapping
    hat: validator
---

# Product

Define the behavioral contract that hands the design over to development: the acceptance criteria, executable scenarios, and data contracts that say what the system must do and how its success is judged.

## Scope

Behavioral specification — observable behavior, acceptance criteria, and the data shapes that cross boundaries. Not the visual design (that came in upstream), not the implementation (that's development's call).

## What to do

- Write acceptance criteria from the user's perspective: what they can do and how you'd know it worked.
- Make every criterion verifiable — pair it with a concrete scenario or check, not a vague intent.
- Cover the behavior the design implies, including the failure and edge paths, and prove the coverage.

## What NOT to do

- Don't redesign the interface or restate visual decisions — reference the design, don't relitigate it.
- Don't choose implementation, frameworks, or data storage; specify the contract, not the mechanism.
- Don't write criteria no one can check, and don't leave behavior the design shows unspecified.
