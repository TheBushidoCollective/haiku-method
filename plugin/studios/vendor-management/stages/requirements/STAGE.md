---
name: requirements
description: Define procurement needs and create RFP
hats: [analyst, specifier, verifier]
fix_hats: [classifier, analyst, feedback-assessor]
review: ask
elaboration: collaborative
inputs: []
---

# Requirements

Define the procurement need and turn it into a structured RFP / RFI / RFQ that vendors can respond to comparably. This stage is the front-end of the vendor lifecycle — every downstream stage (evaluate, negotiate, onboard, monitor) reads from the RFP and the scoring methodology this stage produces.

## Per-unit baton

Each unit walks `analyst → specifier → verifier` in `plan → do → verify` order:

- **`analyst`** (plan) gathers stakeholder needs, classifies them by priority, and produces a structured requirement set
- **`specifier`** (do) turns the requirement set into the RFP / RFI / RFQ document with evaluation criteria and a scoring methodology
- **`verifier`** (verify) validates the knowledge artifact for substance, citation, internal consistency, and decision-register accountability

Detailed process lives in each hat's md file — this stage enforces the chain, not the per-hat content.

## Inputs and outputs

This is the first stage of the studio — no upstream inputs. The output is the RFP document (`outputs/RFP-DOCUMENT.md`) plus the requirement set and evaluation methodology it carries, which feed `evaluate`.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, analyst, feedback-assessor]` dispatches per finding — the classifier routes the FB to the right unit, the analyst re-authors the affected requirements, and the assessor independently decides closure. The gate is `ask` — a human stakeholder approves the RFP locally before vendors are contacted. Project overlays at `.haiku/studios/vendor-management/stages/requirements/` may add house-style conventions (procurement-system-specific RFP templates, organization-specific compliance language, regulated-industry sections) without modifying the plugin defaults.
