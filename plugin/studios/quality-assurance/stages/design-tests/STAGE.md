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

Design the test cases, traceability, and automation strategy that turns the test strategy into executable artifacts. This stage produces a structured test-suite spec — explicit test cases with preconditions / steps / expected results, a traceability matrix linking each test to a requirement, and an automation feasibility assessment.

## Per-unit baton

Units in this stage are **test-design slices** — typically one slice per feature area, integration boundary, or quality dimension declared by the upstream plan. Each unit walks the three hats in `plan → do → verify` order:

- **`designer`** (plan / do for cases) reads the strategy slice, designs the test cases — boundary, equivalence-partition, decision-table, state-transition where applicable — and writes the traceability matrix
- **`automator`** (do for automation) reads the designed cases and produces the automation feasibility assessment (which cases automate, which stay manual, why, what framework category each lands in)
- **`verifier`** (verify) validates substance, upstream trace, internal coherence, decision-register consistency

The baton is the unit body: test cases → cases-plus-automation-strategy → validated artifact.

## Inputs and outputs

The frontmatter declares the I/O contract. `plan/test-strategy` feeds in; the outputs (test-suite spec) feed `execute-tests`.

## Fix loop and gate

`fix_hats: [classifier, designer, feedback-assessor]` dispatches per finding. The classifier routes; `designer` is the implementer (re-authoring cases or trace); the assessor decides closure. The gate is `auto` — once the verifier and review-agent lens pass, the workflow engine advances. Project overlays at `.haiku/studios/quality-assurance/stages/design-tests/` may add house conventions (specific framework choices, ticketing-system links, internal templates) without modifying the plugin defaults.
