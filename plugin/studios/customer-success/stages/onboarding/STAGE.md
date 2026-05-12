---
name: onboarding
description: Guide new customers through setup, training, and initial value realization
hats: [onboarding-lead, technical-enabler, verifier]
fix_hats: [classifier, onboarding-lead, feedback-assessor]
review: ask
elaboration: collaborative
inputs: []
---

# Onboarding

Take a newly closed customer from contract signature to first-value realization. The stage is the entry point of the customer-success lifecycle — there are no upstream inputs from this studio — and produces an `ONBOARDING-REPORT.md` per unit, with each unit framing one onboarding workstream (a stakeholder group, an integration, a training track, a milestone).

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`onboarding-lead`** (plan) reads the sales-handoff context (commitments, stakeholders, success criteria), defines what "initial value" looks like in measurable terms, and writes the milestone plan with owners and acceptance signals per step
- **`technical-enabler`** (do) executes the technical workstream: integration setup, data migration, environment validation, end-to-end test of the deployed configuration, and the run book that captures what was configured and why
- **`verifier`** (verify) validates the operational shape of the report (preconditions, action, post-condition, rollback) and either advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The frontmatter declares the canonical I/O contract. Onboarding has no upstream stage inside this studio (`inputs: []`); its starting context is the user-supplied intent (sales handoff, contract terms, stakeholder list). Each unit produces its slice of `ONBOARDING-REPORT.md` (per-unit body authored across both `onboarding-lead` and `technical-enabler`). The aggregate report feeds the `adoption` stage as the handoff context.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, onboarding-lead, feedback-assessor]` dispatches per finding. The classifier routes the FB; `onboarding-lead` is the implementer (re-defining the milestone or re-sequencing the plan); the assessor independently decides closure. The gate is `ask` — the user reviews the onboarding plan and validates readiness before the workflow advances to adoption. Project overlays at `.haiku/studios/customer-success/stages/onboarding/` may add house conventions (named milestone templates, integration runbook formats, sales-to-CS handoff fields) without modifying the plugin defaults.
