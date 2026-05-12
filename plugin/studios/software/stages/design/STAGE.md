---
name: design
description: Visual and interaction design for user-facing surfaces
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

Where the work gets its shape. The designer translates the elaborated problem into wireframes, component states, interaction specs, and layout rules that downstream stages can build against. Scope is visual and interaction design only — not product contracts, not implementation.

## Per-unit baton

Each design unit walks `designer-prep → designer → design-reviewer`:

- **`designer-prep`** (plan) reads the project's existing design system — tokens, atoms, primitives, layout utilities — and produces `DESIGN-SYSTEM-ANCHOR.md` with concrete specs cited to source. This is the baton; the designer cannot produce coherent UI without it.
- **`designer`** (do) translates the elaborated problem into wireframes, component states, interaction specs, layout rules — all referencing the anchor's tokens / atoms by name, never freelancing values.
- **`design-reviewer`** (verify) confirms the design references real anchor entries, covers every state the brief requires, and is internally consistent.

Detailed process lives in each hat's md file. The discovery picker (`pick_design_direction`) is the engine-level gate that fires before `designer-prep` to lock the visual direction.

## Inputs and outputs

The frontmatter above declares the canonical I/O contract — upstream `inception/discovery` feeds in. Outputs are design artifacts (wireframes, component specs, interaction definitions, layout rules) plus the `DESIGN-BRIEF.md` and `DESIGN-TOKENS.md` that the product stage consumes.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, designer, feedback-assessor]` dispatches per finding. The gate is `[external, ask]` — the user picks between submitting design artifacts for external review or local approval. Project overlays at `.haiku/studios/software/stages/design/` may add team-specific design-system tokens, named design tools, or platform-specific export formats without modifying the plugin defaults.

## Why `designer-prep` is absent from `fix_hats`

The fix loop dispatches `designer` (and `feedback-assessor`) against open feedback — `designer-prep` is intentionally NOT in `fix_hats`. Mirrors the development stage's omission of `planner`: plan-class hats produce upstream baton artifacts (here, `DESIGN-SYSTEM-ANCHOR.md`), not the visual deliverables under review. If a finding targets the anchor itself (wrong color cited, missing state) — which means the plan was wrong — the correct response is a stage revisit that re-runs the full chain, not a fix-loop dispatch that would invoke `designer` against a baton it doesn't author. Do NOT add `designer-prep` here without first changing the architecture's plan-vs-do split.
