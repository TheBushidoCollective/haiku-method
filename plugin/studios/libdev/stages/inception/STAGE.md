---
name: inception
description: Understand the problem, define API surface, and elaborate into units
hats: [researcher, api-architect, distiller, verifier]
fix_hats: [classifier, researcher, feedback-assessor]
review: ask
elaboration: collaborative
inputs: []
---

# Inception

Library inception is a research / distillation stage that covers both discovery (what problem does this solve, who are the target consumers, what's the competitive landscape) AND API shape (public surface, semver policy, extension points, error model). Unlike application development there is no separate product or design phase — API decisions are made here because the API *is* the product.

## Per-unit baton

Each unit walks the four hats in `plan → do → verify` order with an additional architect step for API-shape units:

- **`researcher`** (plan / discovery) gathers ecosystem evidence for the topic — consumers, competing libraries, prior art, constraints
- **`api-architect`** (do for API-shape topics) translates the research into a proposed public signature set + semver policy + error model
- **`distiller`** (do for non-API-shape topics) turns raw research into a structured knowledge artifact
- **`verifier`** (verify) validates the body for substance, citation, internal consistency, and decision-register accountability

Detailed process lives in each hat's md file — this stage's role is to enforce the chain.

## Inputs and outputs

The stage has no upstream inputs (it's the first stage in libdev). Outputs feed every downstream stage: `discovery` artifacts ground the development plan; `api-surface` artifacts are the contract the development stage builds against and the release stage publishes.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, researcher, feedback-assessor]` dispatches per finding. The classifier routes the FB to the right unit and approval roles; `researcher` is the implementer (re-authoring the affected artifact); the assessor independently decides closure. The gate is `ask` — local human approval since the API surface decisions need a human in the loop. Project overlays at `.haiku/studios/libdev/stages/inception/` may add house-style conventions (signature-doc patterns, vocabulary lists, decision-record headers) without modifying the plugin defaults.
