---
name: design
description: Design curriculum structure and learning paths
hats: [designer, subject-expert, verifier]
fix_hats: [classifier, designer, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: needs-analysis
    discovery: needs-assessment
---

# Design

Translate the needs assessment into a curriculum architecture — learning objectives, module sequence, instructional strategies, assessment plan, and delivery modality. The output is a designed solution that the `develop` stage executes against, not yet the materials themselves.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`designer`** (plan) reads the needs assessment and produces a curriculum element — module structure, learning objectives written to Bloom's taxonomy, instructional strategy choice, assessment plan
- **`subject-expert`** (do) validates content accuracy and practical relevance, supplies real-world examples / scenarios / case material, flags outdated content
- **`verifier`** (verify) validates the design artifact for substance, traceability to upstream needs, and internal coherence — advances or rejects to the responsible hat

The detailed process for each role lives in the hat's md file. This stage's job is to enforce the chain.

## Inputs and outputs

Reads `needs-analysis/needs-assessment` for every unit. Output is `CURRICULUM-PLAN.md` per unit — the designed curriculum element that downstream stages build, deliver, and evaluate against.

## Fix loop and gate

Review feedback dispatches the `fix_hats: [classifier, designer, feedback-assessor]` chain. Gate is `ask` — the user approves the curriculum design locally before development begins, because design decisions (modality choice, assessment strategy, module sequencing) compound across every later stage. Project overlays at `.haiku/studios/training/stages/design/` may add house conventions (organization-specific competency model, branded instructional templates, named delivery channels) without modifying the plugin defaults.
