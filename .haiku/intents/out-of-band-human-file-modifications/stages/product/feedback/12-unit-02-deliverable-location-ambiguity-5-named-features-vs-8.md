---
title: >-
  Unit-02 deliverable location ambiguity: 5 named features vs 8 different files
  in outputs/features/
status: closed
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-04-29T03:43:46Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-12:bolt-1'
bolt: 0
triaged_at: '2026-04-29T03:43:46Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T20:09:14Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-04-29T20:11:54Z'
    result: closed
---
## Finding

Unit-02 deliverable location ambiguity: 5 named features vs 8 different files in outputs/features/. The 8 files in `stages/product/outputs/features/` are contract-verification scenarios (schema, HTTP API, MCP tool, event payloads in Gherkin), not the 5 canonical user-behavior `.feature` files that live at `features/` in the intent root. No documentation existed to tell downstream consumers which set to bind against.

## Root cause

The 8 `outputs/features/` files were generated alongside `outputs/DATA-CONTRACTS.md` as regression-test fixtures for the contract layer. Their role was correct, but their relationship to the canonical 5 user-behavior features was undocumented. Without a routing guide, the development stage's step-definition layer had no way to know which set to bind against.

## Fix applied

Two files added:

1. **`stages/product/outputs/features/README.md`** (created) — declares this directory supplementary (not the unit-02 deliverable), names the 5 canonical files at `features/` at the intent root, and provides a routing table mapping each of the 8 files to its corresponding `DATA-CONTRACTS.md` section. States explicitly: development stage step-definitions layer binds against `/features/` (canonical 5); development stage contract-test layer binds against `outputs/features/` (these 8).

2. **`product/DATA-CONTRACTS.md` Appendix A** (added before §8) — names the 8 companion files with their section cross-references, and states that they are NOT canonical user-behavior features. Points downstream consumers to the README for the full routing table.

## Files changed

- `.haiku/intents/out-of-band-human-file-modifications/stages/product/outputs/features/README.md` (created)
- `.haiku/intents/out-of-band-human-file-modifications/product/DATA-CONTRACTS.md` (Appendix A added)

## Commit

`55a89b10` — haiku: fix FB-12 (outputs/features/ disambiguation — Appendix A + README)
