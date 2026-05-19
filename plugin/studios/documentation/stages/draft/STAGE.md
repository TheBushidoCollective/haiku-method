---
name: draft
description: Write the documentation content following the approved outline
hats: [writer, technical-reviewer, verifier]
fix_hats: [classifier, writer, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: outline
    discovery: document-outline
---

# Draft

Turn the approved outline into prose, code samples, and visuals. Drafting is the build stage of this studio — its deliverable is the actual documentation content readers will see.

## Per-unit baton

Each draft unit walks three hats in `plan/do → lens-review → verify` order:

- **`writer`** (plan / do) reads the assigned outline section, drafts the prose, examples, and code blocks for that section, and verifies claims against the source of truth as they write
- **`technical-reviewer`** (lens-review) checks every technical claim against the system, tests every code sample, validates API signatures and configuration values, and advances or rejects with the responsible failure named
- **`verifier`** (verify) walks the unit body's substance, citation, internal consistency, and decision-register consistency — the structural check the technical-reviewer's domain lens does not cover

The baton: outline section + audit context → drafted prose with verified examples → lens-reviewed draft → substance-checked unit ready for editorial review.

## Inputs and outputs

Consumes the outline stage's `document-outline`. Produces `DRAFT-CONTENT.md` — the unedited but technically-verified draft.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, writer, feedback-assessor]` dispatches per finding. The classifier targets the FB; the writer revises prose, examples, or claims; the assessor decides closure. The gate is `ask` — the user signs off on draft completeness before editorial review begins. Project overlays at `.haiku/studios/documentation/stages/draft/` may bind voice, terminology, and code-sample conventions to the project's house style.
