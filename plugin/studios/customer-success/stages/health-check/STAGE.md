---
name: health-check
description: Monitor account health, identify risks, and create action plans
hats: [health-monitor, risk-analyst, verifier]
fix_hats: [classifier, health-monitor, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: adoption
    discovery: usage-report
---

# Health Check

Assess current account health across multiple dimensions and convert the read into ranked risks with concrete mitigation plans. The stage takes the adoption usage report as its starting condition and produces a `HEALTH-REPORT.md` per unit, with each unit framing one account, segment, or risk surface.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`health-monitor`** (plan) reads the usage report and any external signals (support volume, sentiment, stakeholder access), then writes the multi-dimensional scorecard: each dimension rated with explicit evidence, plus a trend versus the prior period
- **`risk-analyst`** (do) reads the scorecard, identifies the churn-risk indicators (leading and lagging, separated), ranks them by severity and reversibility, and writes the mitigation plan with owners and measurable success criteria
- **`verifier`** (verify) validates the operational shape of the report (preconditions, action, post-condition, rollback) and either advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The frontmatter declares the canonical I/O contract. Upstream `adoption/usage-report` feeds in; each unit produces its slice of `HEALTH-REPORT.md` (per-unit body authored across both `health-monitor` and `risk-analyst`). The aggregate report feeds the `expansion` stage as the qualifying signal for which accounts are healthy enough to grow.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, health-monitor, feedback-assessor]` dispatches per finding. The classifier routes the FB; `health-monitor` is the implementer (re-rating the dimension or re-evidencing the score); the assessor independently decides closure. The gate is `ask` — the user reviews the health read and risk plan and approves locally before the workflow advances. Project overlays at `.haiku/studios/customer-success/stages/health-check/` may add house conventions (named health-score formula, named risk tiers, account-segmentation rules) without modifying the plugin defaults.
