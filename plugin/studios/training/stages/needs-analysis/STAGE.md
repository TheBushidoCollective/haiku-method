---
name: needs-analysis
description: Conduct skills gap analysis and define learning objectives
hats: [analyst, consultant, verifier]
fix_hats: [classifier, analyst, feedback-assessor]
review: auto
elaboration: collaborative
inputs: []
---

# Needs Analysis

Establish whether training is the right intervention, who needs it, and what they need to be able to do at the end of it. This is the upstream knowledge stage for the entire training lifecycle — the rest of the studio consumes what you produce here. If the needs are wrong, every later stage delivers the wrong program well.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`analyst`** (plan) gathers performance data, audience profile, and the competency baseline; quantifies the gap between current and target performance
- **`consultant`** (do) interprets the gap, confirms training is the right lever (vs. process / tooling / hiring), and recommends modality and learning objectives
- **`verifier`** (verify) validates the captured artifact for substance, citation, and internal consistency — advances or rejects to the responsible hat

The detailed process for each role lives in the hat's md file. This stage's job is to enforce the chain.

## Inputs and outputs

This is the lifecycle's entry stage — no upstream stage feeds it. Output is `NEEDS-ASSESSMENT.md` per unit: an investigation of one population, role, or capability gap. Every downstream stage (`design`, `develop`, `deliver`, `evaluate`) reads these.

## Fix loop and gate

Review feedback dispatches the `fix_hats: [classifier, analyst, feedback-assessor]` chain. Gate is `auto` — the workflow engine advances once review agents sign off, since needs analysis tends to iterate within the studio rather than gate on an external stakeholder review. Project overlays at `.haiku/studios/training/stages/needs-analysis/` may add house conventions (specific competency frameworks, stakeholder-interview templates, organization-specific role taxonomies) without touching the plugin defaults.
