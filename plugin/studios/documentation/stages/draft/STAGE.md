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

- `writer` → `technical-reviewer`: drafted prose, code samples, and visuals for the outline section, with source-of-truth citations.
- `technical-reviewer` → `verifier`: lens-reviewed draft (technical claims confirmed or findings filed against specific claims).

## Inputs and outputs

Consumes the outline stage's `document-outline`. Produces `DRAFT-CONTENT.md` — the unedited but technically-verified draft.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, writer, feedback-assessor]` dispatches per finding. The classifier targets the FB; the writer revises prose, examples, or claims; the assessor decides closure. The gate is `ask` — the user signs off on draft completeness before editorial review begins. Project overlays at `.haiku/studios/documentation/stages/draft/` may bind voice, terminology, and code-sample conventions to the project's house style.
