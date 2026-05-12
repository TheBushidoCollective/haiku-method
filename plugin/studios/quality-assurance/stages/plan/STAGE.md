---
name: plan
description: Define test strategy and coverage planning
hats: [strategist, planner, verifier]
fix_hats: [classifier, strategist, feedback-assessor]
review: ask
elaboration: collaborative
inputs: []
---

# Plan

Define the test strategy and execution plan that anchors every downstream QA stage. This stage produces the test strategy (scope, risk-based prioritization, quality dimensions, entry / exit criteria) and the execution plan (resources, environments, scheduling, data) — the contract the rest of the QA lifecycle reads from.

## Per-unit baton

Units in this stage are **test-strategy elements** — distinct facets of the plan (scope definition, risk model, environment requirements, exit criteria). Each unit walks the three hats in `plan → do → verify` order:

- **`strategist`** (plan) reads product / requirements inputs, defines scope and risk-based prioritization for this slice of the strategy
- **`planner`** (do) translates the strategy slice into concrete logistics — resource allocation, environment, data, scheduling
- **`verifier`** (verify) validates the slice against substance + decision-register consistency and either advances or rejects to the responsible hat

The baton is the unit body itself, accumulating from scope-and-risk to logistics to validated artifact.

## Inputs and outputs

The frontmatter declares the I/O contract. The plan stage has no upstream stages — it reads from the intent's product / requirement context directly. Outputs feed `design-tests`, `execute-tests`, `analyze`, and `certify`.

## Fix loop and gate

`fix_hats: [classifier, strategist, feedback-assessor]` dispatches per finding. The classifier routes the FB; `strategist` is the implementer (re-authoring the strategy slice where the finding lives); the assessor decides closure. The gate is `ask` — a human approves the strategy locally before tests are designed against it. Project overlays at `.haiku/studios/quality-assurance/stages/plan/` may add house conventions (specific risk-rating scales, organizational templates, ticketing-system embeds) without modifying the plugin defaults.
