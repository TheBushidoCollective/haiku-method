---
name: design-direction
location: .haiku/intents/{intent-slug}/stages/design/artifacts/design-direction.md
scope: stage
format: text
required: true
tool: pick_design_direction
---

# Design Direction

Capture the user's design direction for this stage before any wireframes or unit specs land. The direction is a strategic choice (which visual archetype, which reference materials) that the rest of the design phase orbits.

## How this discovery agent works

This template is **tool-driven**: the agent calls the `pick_design_direction` MCP tool. The tool opens the SPA picker, blocks on the user's submission, and writes a manifest to the `location:` declared above. The cursor's existence check on that file passes the gate — same artifact-driven model as every other discovery template.

Two submission modes inside the picker:

- **Archetype mode.** The agent generates 2–3 distinct HTML wireframe archetypes (different layouts, interaction patterns, or visual hierarchies). The user picks one and optionally annotates screenshots with comments. The manifest records the chosen archetype, comments, and any annotated screenshots saved under `stages/<stage>/artifacts/design-direction/dd-NN-*.png`.
- **Upload mode.** The user uploads reference materials (mockups, mood boards, real-product screenshots, design files — any non-empty MIME). The manifest records the uploaded files with optional captions; uploads land under `stages/<stage>/artifacts/design-direction/uploads/up-NN-*`.

## Calling the tool

```
pick_design_direction { intent: "<slug>" }
```

Optional arguments documented on the tool itself: pre-generated archetypes, default mode, picker affordances. Defaults are usually correct.

When the tool returns, call `haiku_run_next` to re-tick. The cursor will read `stages/{stage}/artifacts/design-direction.md`, see it on disk, and clear the discovery gate.

## Why this is a discovery agent and not a bespoke gate

Pre-2026-05-08 the cursor had three dedicated actions for design direction (`design_direction_required`, `design_direction_complete`, `design_direction_uploaded`) plus a STAGE.md flag (`requires_design_direction: true`). They worked but lived parallel to the rest of discovery — same shape (gate on a chosen artifact) under different machinery. The reframe collapses both onto one mechanism: studio declares an artifact contract, agent runs the named tool, file existence is the signal.

This also makes the pattern reusable. Any future "user input drives stage direction" need (mood-board picker, brand-voice picker, target-audience picker, etc.) is just another discovery template with a `tool:` field.
