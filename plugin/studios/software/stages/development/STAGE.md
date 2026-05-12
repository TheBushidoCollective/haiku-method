---
name: development
description: Implement the specification through code
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

Implement the product stage's specification through code. The contract handed in is `ACCEPTANCE-CRITERIA.md` + Gherkin `.feature` files + `DATA-CONTRACTS.md`; this stage's output is working code, passing tests, and the architecture decisions that landed along the way.

## Per-unit baton

Each development unit walks `planner → builder → reviewer` (or stage-equivalent named roles):

- **`planner`** (plan) reads the AC, the `.feature` scenarios, data contracts, and existing code; produces the AC-to-test mapping table + change plan + risk register inline in the unit body
- **`builder`** (do) executes the plan in TDD increments — RED failing test → GREEN minimum code → REFACTOR, one row of the planner's table at a time
- **`reviewer`** (verify) runs the unit's quality gates, walks the AC → test → implementation trace, and either advances or rejects with the responsible hat named

Detailed process lives in each hat's md file; this stage's job is to enforce the chain, not to repeat it.

## Inputs and outputs

The frontmatter above declares the canonical I/O contract — upstream `inception/discovery`, `design/{design-brief, design-tokens, design-artifacts}`, and `product/{acceptance-criteria, behavioral-spec, data-contracts}` feed in; this stage's output is code + tests merged into the project's main branch.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, builder, feedback-assessor]` dispatches per finding — `planner` is intentionally NOT in `fix_hats` because plan-class hats produce upstream baton artifacts (the change plan in the unit body), not the implementation the reviewer is grading. A finding that says the plan was wrong is a stage-revisit, not a fix-loop dispatch. The gate is `[external, ask]` — the user picks between submitting the diff for external review (PR / MR on the project's hosting) or local approval. Project overlays at `.haiku/studios/software/stages/development/` may add team-specific commit conventions, named test runners, or coverage thresholds without modifying the plugin defaults.
