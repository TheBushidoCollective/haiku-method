---
name: renewal
description: Prepare renewal strategy, negotiate terms, and secure commitment
hats: [renewal-manager, executive-sponsor, verifier]
fix_hats: [classifier, renewal-manager, feedback-assessor]
review: [external, await]
elaboration: collaborative
inputs:
  - stage: expansion
    discovery: opportunity-brief
---

# Renewal

Convert the account's realized value and identified expansion paths into a committed renewal. The stage takes the expansion opportunity brief as its starting condition and produces a `RENEWAL-STRATEGY.md` per unit, with each unit framing one renewal motion (one account, one segment-wide play, or one renewal-cohort campaign).

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`renewal-manager`** (plan) reads the expansion brief and the account's value-realization signals, builds the renewal narrative (where they started, what they achieved, where they can go next), anticipates objections, and writes the negotiation strategy with concession boundaries and walk-away conditions
- **`executive-sponsor`** (do) layers the executive-level engagement: a CxO-tailored forward narrative, partnership-future framing, board-level outcome connections, and the specific touch (in-person review, written brief, joint-roadmap session) the renewal calls for
- **`verifier`** (verify) validates the operational shape of the strategy (preconditions, action, post-condition, rollback) and either advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The frontmatter declares the canonical I/O contract. Upstream `expansion/opportunity-brief` feeds in; each unit produces its slice of `RENEWAL-STRATEGY.md` (per-unit body authored across both `renewal-manager` and `executive-sponsor`). The aggregate strategy is the studio's terminal artifact — it feeds the actual customer-facing renewal conversation outside of the workflow.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, renewal-manager, feedback-assessor]` dispatches per finding. The classifier routes the FB; `renewal-manager` is the implementer (re-framing the narrative or re-sequencing the negotiation); the assessor independently decides closure. The gate is `[external, await]` — the strategy is submitted for external sign-off (e.g., commercial / legal approval inside the user's organization) and then waits for the customer-side renewal-event signal before the workflow finalizes. Project overlays at `.haiku/studios/customer-success/stages/renewal/` may add house conventions (named concession tiers, commercial-approval routing, executive-touchpoint templates) without modifying the plugin defaults.
