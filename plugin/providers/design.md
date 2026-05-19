---
provider_kind: design
category: source
always_on: false
splices_into:
  - elaborate
description: Design source provider — pull existing designs, components, and tokens to align units to the design system.
---

# Design Provider — Behavior Contract

A design provider is configured (Figma, Pencil, Penpot, Excalidraw, Canva, OpenPencil) when `providers.design.*` is set in `.haiku/settings.yml`. This is a **source** provider for H·AI·K·U's purposes — read designs that already exist, align stage outputs to them. Don't push designs back unless the user explicitly asks (and the relevant MCP tool with write access is available).

## What you, the agent, must do

### At elaborate (design stage)
- Pull the existing design file(s) referenced in the intent. Record each as `external_refs.design_*` on the relevant unit.
- Extract design tokens (colors, spacing, typography) and stage them as discovery inputs. Down-stream units cite the token names.
- Surface component inventory: what already exists that the units can reuse vs what's new.

### At elaborate (development / non-design stages)
- Re-fetch design refs the design stage produced. Verify they haven't drifted since the design stage closed. Surface drift to the user.

### At decompose
- Every UI unit cites the relevant design ref in `inputs:`. The reference is enough — don't try to inline the design content into the unit body.
- Map component names from the design system to implementation modules. If a unit's scope includes a named component, the unit's title and body should match the component name.

## When to push back

Push to the design tool only when:
1. The user explicitly asks ("update the Figma component"), AND
2. You have the write tool available for the configured design provider.

Default behavior is read-only. The design tool is the source of truth; H·AI·K·U units are the implementation.

## Per-tool storage convention

When recording a design reference in `external_refs:`, use the per-tool URI convention:

| Tool | URI |
|---|---|
| Figma | `figma://<file_key>#node=<node_id>` |
| Penpot | `penpot://<host>/<project_id>/<file_id>#component=<id>` |
| Pencil / OpenPencil | `pencil://<document_id>#node=<node_id>` |
| Canva | `canva://<design_id>#page=<n>` |
| Excalidraw | `excalidraw://<drawing_id>` or `excalidraw://local/<file_path>` |

## What NOT to do

- Don't fabricate `design_ref` URIs. If you can't reach the design tool, leave the field empty and surface the gap.
- Don't push wireframes or mockups H·AI·K·U produces back to the design tool by default — they're stage artifacts, not design-tool-of-truth content.
- Don't load the entire design file into context if a single frame or component is enough.
