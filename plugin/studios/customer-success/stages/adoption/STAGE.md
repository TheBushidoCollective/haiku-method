---
name: adoption
description: Drive product adoption, usage patterns, and feature discovery
hats: [adoption-coach, usage-analyst, verifier]
fix_hats: [classifier, adoption-coach, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: onboarding
    discovery: onboarding-report
---

# Adoption

Drive deeper, more durable use of the product after the customer is live. The stage takes the onboarding handoff as its starting condition and produces a `USAGE-REPORT.md` per unit, with each unit framing one adoption play (a specific feature, workflow, persona, or segment to move from low to meaningful use).

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`adoption-coach`** (plan) reads the onboarding report and any prior usage signals, names the adoption play, and writes the enablement strategy tied to a business outcome
- **`usage-analyst`** (do) instruments the play, pulls the actual usage signals, and writes the unit's slice of `USAGE-REPORT.md` with a baseline, target, and gap analysis
- **`verifier`** (verify) validates the operational shape of the report (preconditions, action, post-condition, rollback) and either advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The frontmatter declares the canonical I/O contract. Upstream `onboarding/onboarding-report` feeds in; each unit produces its slice of `USAGE-REPORT.md` (per-unit body authored by the `usage-analyst` hat). The aggregate report feeds the `health-check` stage as its primary signal.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, adoption-coach, feedback-assessor]` dispatches per finding. The classifier routes the FB to the right unit or stage; `adoption-coach` is the implementer (re-authoring the enablement play where the finding lands); the assessor independently decides closure. The gate is `auto` — once the verifier signs off, the workflow advances without a human checkpoint. Project overlays at `.haiku/studios/customer-success/stages/adoption/` may add house conventions (specific CRM / CSM-tool fields, scorecard formats, segment definitions) without modifying the plugin defaults.
