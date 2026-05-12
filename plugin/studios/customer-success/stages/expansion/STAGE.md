---
name: expansion
description: Identify and pursue upsell/cross-sell opportunities
hats: [growth-strategist, value-consultant, verifier]
fix_hats: [classifier, growth-strategist, feedback-assessor]
review: [ask, await]
elaboration: collaborative
inputs:
  - stage: health-check
    discovery: health-report
---

# Expansion

Identify, qualify, and pursue expansion opportunities — upsell, cross-sell, additional seats, premium tiers — grounded in the account's current health and demonstrated value. The stage takes the health report as its starting condition and produces an `OPPORTUNITY-BRIEF.md` per unit, with each unit framing one expansion path (a specific product, module, capacity tier, or segment expansion).

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`growth-strategist`** (plan) reads the health report, identifies the candidate path, and writes the qualifying logic: who buys, why now, what gap it closes, what signals confirm or refute fit
- **`value-consultant`** (do) builds the business case for this path: ROI model from the customer's own data, stakeholder-specific narratives, phased adoption plan, defensible revenue estimate
- **`verifier`** (verify) validates the operational shape of the brief (preconditions, action, post-condition, rollback) and either advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The frontmatter declares the canonical I/O contract. Upstream `health-check/health-report` feeds in; each unit produces its slice of `OPPORTUNITY-BRIEF.md` (per-unit body authored across both `growth-strategist` and `value-consultant`). The aggregate brief feeds the `renewal` stage as the renewal-conversation expansion narrative.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, growth-strategist, feedback-assessor]` dispatches per finding. The classifier routes the FB; `growth-strategist` is the implementer (re-qualifying the path or the business case); the assessor independently decides closure. The gate is `[ask, await]` — the user picks between a local approval (`ask`) and waiting for an external event (`await`, e.g., customer response to the proposal) before the workflow advances. Project overlays at `.haiku/studios/customer-success/stages/expansion/` may add house conventions (specific deal-stage definitions, internal pricing-approval flow, named ROI templates) without modifying the plugin defaults.
