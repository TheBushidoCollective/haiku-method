---
name: product
description: Define behavioral specifications and acceptance criteria
hats: [product, specification, validator]
fix_hats: [classifier, product, feedback-assessor]
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

Define behavioral specifications and acceptance criteria — the contract that hands the design over to development. This stage produces three artifact families per unit (`ACCEPTANCE-CRITERIA.md`, `.feature` files under `features/`, `DATA-CONTRACTS.md`) plus one intent-scope `COVERAGE-MAPPING.md`.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`product`** (plan) reads design + inception, writes the AC for this slice of behavior
- **`specification`** (do) turns the AC into Gherkin scenarios + data contracts
- **`validator`** (verify) builds the coverage matrix and either advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The frontmatter above declares the canonical I/O contract. Upstream `inception/discovery` and `design/{design-brief, design-tokens}` feed in; the four outputs feed `development` and any downstream certification stages.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, product, feedback-assessor]` dispatches per finding. The gate is `[external, ask]` — the user picks between submitting the AC for external review (e.g., engineering signoff in a docs platform) or local approval. Project overlays at `.haiku/studios/software/stages/product/` may add house-style conventions (section numbering, design-system tokens, doc-platform headers) without modifying the plugin defaults.
