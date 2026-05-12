---
name: charter
description: Define project scope, stakeholders, and success criteria
hats: [sponsor, scoper, verifier]
fix_hats: [classifier, sponsor, feedback-assessor]
review: external
elaboration: collaborative
inputs: []
outputs:
  - discovery: project-charter
    hat: scoper
---

# Charter

Define the business case, scope, stakeholders, and measurable success criteria. The charter is the contract every later stage reads — `plan` decomposes against it, `track` measures against it, `close` accepts against it. A weak charter cascades downstream: scope drift, unclear authority, success without proof.

## Per-unit baton

Each unit is a charter element (business case, scope boundary, success criterion, stakeholder, governance decision). The three hats walk it in `plan → do → verify` order:

- **`sponsor`** (plan) frames the business case, defines measurable success criteria, and establishes governance and decision rights
- **`scoper`** (do) translates the frame into explicit in-scope / out-of-scope boundaries, constraints, assumptions, and the stakeholder map
- **`verifier`** (verify) checks the body for substance, source citation, internal consistency, and decision-register accountability — advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The charter stage has no upstream inputs — it's the first stage of the studio. Its output is `PROJECT-CHARTER.md`, which every downstream stage consumes.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, sponsor, feedback-assessor]` dispatches per finding. The classifier routes the FB to the right charter element; `sponsor` re-authors the relevant section; the assessor independently decides closure. The gate is `external` — sponsor sign-off typically happens outside the plugin (signed charter document, kickoff approval). Project overlays at `.haiku/studios/project-management/stages/charter/` may add house-style numbering, doc-platform conventions, or specific PM-tool integration without modifying the plugin defaults.
