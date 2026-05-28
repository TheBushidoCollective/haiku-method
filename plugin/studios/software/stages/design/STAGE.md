---
name: design
description: Visual and interaction design for user-facing surfaces
optional: true
hats: [designer-prep, designer, design-reviewer]
fix_hats: [classifier, designer, feedback-assessor]
review: [external, ask]
elaboration: collaborative
# Design direction (2026-05-08 reframe): the picker is now a
# discovery agent. See `discovery/DESIGN-DIRECTION.md` — it declares
# `tool: pick_design_direction` so the cursor's tool-driven discovery
# branch fires. The bespoke `requires_design_direction: true` flag is
# retired; the discovery existence check on
# `stages/design/artifacts/design-direction.md` is the gate.
inputs:
  - stage: inception
    discovery: discovery
---

# Design

Where the work gets its shape: translate the elaborated problem into the wireframes, component states, interaction specs, and layout rules that downstream stages build against.

## Scope

Visual and interaction design for user-facing surfaces — what the work looks like and how it behaves to the touch. Not the behavioral contract (product), not implementation (development).

## What to do

- Reference the project's existing design system — its tokens, atoms, and primitives — by name, citing source.
- Cover every state the problem requires: default, empty, loading, error, and the edges in between.
- Keep designs internally consistent and concrete enough that development can build from them without guessing.

## What NOT to do

- Don't invent values — colors, spacing, type — that the design system already defines.
- Don't specify behavior, acceptance criteria, or data contracts; that's the product stage.
- Don't write code or choose implementation technology.
