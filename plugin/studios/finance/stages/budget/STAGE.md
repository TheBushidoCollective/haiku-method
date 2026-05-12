---
name: budget
description: Allocate resources and set financial targets
hats: [budget-owner, allocator, verifier]
fix_hats: [classifier, budget-owner, feedback-assessor]
review: external
elaboration: collaborative
inputs:
  - stage: forecast
    discovery: forecast-model
---

# Budget

Translate the forecast into a resource allocation plan: an envelope sized to the projected revenue, departmental and cost-center allocations traceable to forecast drivers, target levels with measurement criteria, and contingency reserves sized from historical variance patterns rather than arbitrary percentages.

The stage produces one intent-scope artifact (`BUDGET-PLAN.md` under `stages/budget/artifacts/`) plus per-unit allocation specs.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`budget-owner`** (plan) reads the forecast and sets the envelope, allocation methodology, and priority ranking for this slice of the budget
- **`allocator`** (do) maps the budget-owner's priorities onto specific departments / cost centers / line items, validates resource availability, and documents allocation rationale
- **`verifier`** (verify) reads the unit body and advances or rejects on substance, traceability to upstream forecast lines, internal coherence, and decision-register alignment

Detailed process lives in each hat's md file.

## Inputs and outputs

The frontmatter declares the canonical I/O contract. Upstream `forecast/forecast-model` feeds in; `budget-plan` feeds `analysis` (for variance comparisons) and `reporting`.

## Fix loop and gate

`fix_hats: [classifier, budget-owner, feedback-assessor]` dispatches per finding — classifier targets the affected allocation, `budget-owner` re-derives that slice from the envelope and priorities, `feedback-assessor` decides closure. The gate is `external` because budget allocations typically require finance-leadership signoff outside this loop (a budget committee, the CFO, board review); the engine waits for that approval signal to land before advancing. Project overlays may add house-style conventions (chart-of-accounts numbering, internal hierarchy mappings, approval matrix templates).
