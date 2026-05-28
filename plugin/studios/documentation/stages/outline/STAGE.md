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

The information-architecture stage of the documentation lifecycle: translate the audit's ranked gaps into a navigable structure before any prose lands. This is where the shape of the docs gets decided — what gets written, in what mode, in what order, and how the pieces connect.

## Scope

Designing the section hierarchy, the per-section purpose, the doc mode (tutorial / how-to / reference / explanation), and the navigation paths between pieces. Outline decides *the structure* — it does not assess the existing docs (audit) or write the content that fills the structure (draft).

## What to do

- Translate each prioritized gap into a placed section with a stated purpose.
- Tag each section with its doc mode and keep the modes from blurring into one another.
- Lay out the navigation paths a reader takes between sections, not just a flat list.
- Check the structure against real reader journeys before drafting commits to it.

## What NOT to do

- Don't re-audit the existing docs or re-rank gaps — carry forward what audit established.
- Don't write the prose, code samples, or visuals — that's the draft stage.
- Don't leave a section without a clear purpose statement.
- Don't defer structural decisions to drafting; IA changes after prose lands are expensive.
