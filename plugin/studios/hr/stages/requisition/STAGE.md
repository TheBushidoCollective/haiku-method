---
name: requisition
description: Define role requirements and create job description
hats: [hiring-manager, recruiter, verifier]
fix_hats: [classifier, hiring-manager, feedback-assessor]
review: ask
elaboration: collaborative
inputs: []
---

# Requisition

The opening stage of the hiring lifecycle. Turns a vague need ("we need to hire someone") into a defensible role specification that downstream sourcing, screening, and interview stages can act on. Every later stage reads this stage's output as authoritative — bad requisition decisions compound into the entire pipeline.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`hiring-manager`** (plan) names the business need, the gap this role fills, the must-have vs nice-to-have competencies, and the budget envelope
- **`recruiter`** (do) translates that into a market-tested job description: realistic requirements, an attractive value proposition, a sourcing plan, and a defensible compensation range
- **`verifier`** (verify) checks the artifact for substance, internal consistency, and decision-register alignment — advances or rejects

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

There are no upstream stages — requisition is the entry point. The single output is `JOB-SPEC.md` at intent scope, consumed by every downstream stage (sourcing pulls outreach context, screening pulls must-have criteria, interview pulls competencies, offer pulls compensation framing).

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, hiring-manager, feedback-assessor]` dispatches per finding. The classifier routes the finding; `hiring-manager` re-authors the affected section (a recruiter-only fix risks losing the underlying business framing); the assessor decides closure independently. The gate is `ask` — a human approver signs off locally because requisition decisions touch budget, headcount, and equity-band placement that the agent should not seal alone.

Sensitive topic note: requirements language can inadvertently encode protected-class signals (age, gender, parental-status proxies). When the artifact touches these areas, defer to human review and, where applicable, jurisdictional employment counsel — the plugin does not dispense legal interpretations.
