---
name: research
description: Understand the prospect, their business, pain points, and competitive landscape
hats: [prospect-researcher, industry-analyst, verifier]
fix_hats: [classifier, prospect-researcher, feedback-assessor]
review: auto
elaboration: autonomous
inputs: []
---

# Research

The research stage turns a named prospect (and the seller's hypothesis about them) into a structured `PROSPECT-BRIEF.md` that every later stage in the sales lifecycle consumes. This stage is research/distillation per architecture §4.1 — units are knowledge topics about the prospect, not execution work.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`prospect-researcher`** (plan/do) investigates one knowledge topic about the prospect — the company itself, a specific stakeholder cluster, the buying committee, the tech environment, a recent strategic shift, etc. Produces raw findings with cited sources.
- **`industry-analyst`** (do) reframes the researcher's findings into sales-relevant intelligence — competitive pressure on this prospect specifically, regulatory drivers, market timing signals that create urgency or risk.
- **`verifier`** (verify) validates the unit body for substance, citation, internal consistency, and decision-register alignment, then advances or rejects.

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The research stage takes nothing from upstream (it's the entry point of the sales lifecycle); its outputs feed `qualification`, `proposal`, `negotiation`, and `close`. The single intent-scope artifact is `PROSPECT-BRIEF.md` (declared in `discovery/`); per-unit bodies are the working drafts that the brief consolidates from.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, prospect-researcher, feedback-assessor]` dispatches per finding. The gate is `auto` — research is a knowledge-distillation stage, no external human signoff is required to advance to qualification. Project overlays at `.haiku/studios/sales/stages/research/` may add house-style conventions (specific data sources to consult, named research playbooks, account-tiering frameworks) without modifying the plugin defaults.
