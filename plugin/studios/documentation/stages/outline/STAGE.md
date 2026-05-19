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

Each outline unit walks three hats in `plan → lens-review → verify` order:

- **`architect`** (plan / do) designs the IA for the unit's scope — section hierarchy, doc-mode per piece, navigation paths, cross-references
- **`outline-reviewer`** (lens-review) walks user journeys through the proposed structure and surfaces journey gaps the architect missed
- **`verifier`** (verify) checks the IA body for completeness, coverage of the audit's ranked gaps, and consistency between the structure and the named audience — substance not journey

The baton: ranked gaps + named audience → drafted IA with per-section purpose statements and Diátaxis mode tags → journey-checked structure → substance-verified IA ready for drafting.

## Inputs and outputs

Consumes the audit stage's `audit-report` (the ranked gap list with recommended doc modes). Produces `DOCUMENT-OUTLINE.md` — the structure draft uses as its plan.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, architect, feedback-assessor]` dispatches per finding. The classifier targets the FB; the architect re-structures or re-sequences; the assessor decides closure. The gate is `ask` — outline benefits from a human pass on the proposed structure before drafting begins, since IA changes after drafting are expensive.
