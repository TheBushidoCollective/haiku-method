---
name: outline
description: Structure the documentation with clear information architecture
hats: [architect, outline-reviewer, verifier]
fix_hats: [classifier, architect, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: audit
    discovery: audit-report
---

# Outline

Translate the audit's ranked gap list into a navigable information architecture. The outline stage decides what gets written, in what mode (tutorial / how-to / reference / explanation), in what order, and how the pieces connect — before any prose lands.

## Per-unit baton

- `architect` → `outline-reviewer`: drafted IA (section hierarchy, per-section purpose statements, Diátaxis mode tags, navigation paths).
- `outline-reviewer` → `verifier`: journey-checked IA (structure confirmed or journey-gap findings filed).

## Inputs and outputs

Consumes the audit stage's `audit-report` (the ranked gap list with recommended doc modes). Produces `DOCUMENT-OUTLINE.md` — the structure draft uses as its plan.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, architect, feedback-assessor]` dispatches per finding. The classifier targets the FB; the architect re-structures or re-sequences; the assessor decides closure. The gate is `ask` — outline benefits from a human pass on the proposed structure before drafting begins, since IA changes after drafting are expensive.
