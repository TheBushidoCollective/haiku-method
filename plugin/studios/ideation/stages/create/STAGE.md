---
name: create
description: Generate the primary deliverable using research insights
hats: [creator, editor, verifier]
fix_hats: [classifier, creator, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: research
    discovery: research-brief
---

# Create

Generate the primary deliverable using research insights. This stage takes the research brief and produces a draft deliverable — the artifact the intent is ultimately about (recommendation memo, slate of generated concepts, How-Might-We problem framing, analytical report, content piece). Substance first; the editor passes to sharpen, not to invent.

## What a unit IS for this stage

Each unit is a **section, component, or concept** of the deliverable. For a memo: each top-level argument is a unit. For an ideation slate: each cluster of related concepts (or each How-Might-We question being explored) is a unit. For a structured report: each chapter / section is a unit. The decompose phase decides the cut.

## Per-unit baton

Units walk three hats in `plan → do → verify` order:

- **`creator`** (plan + do) drafts the section from the research brief, applying divergent generation where the work calls for it (lateral, analogical, constraint-based variation) and convergent narrowing where it calls for that
- **`editor`** (do) refines clarity, structure, and argument strength without altering the creator's meaning
- **`verifier`** (verify) validates the body for substance, traceability to upstream inputs, internal coherence, and decision-register consistency

Detailed per-hat process lives in each hat's md file.

## Inputs and outputs

Inputs: `research/research-brief`. Output: per-section content that composes into `DRAFT-DELIVERABLE.md` at intent scope. Cross-section consistency (terminology, voice, level of detail) is the editor's responsibility; the verifier checks it.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, creator, feedback-assessor]` dispatches per finding. Gate is `ask` — local human approval is the path of least surprise for a creative deliverable. Project overlays may upgrade this to `external` (e.g., docs-platform review) without touching the plugin default.
