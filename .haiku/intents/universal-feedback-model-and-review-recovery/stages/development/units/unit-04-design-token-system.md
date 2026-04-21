---
title: Design token system in haiku-ui
type: implementation
depends_on:
  - unit-03-extract-haiku-ui-package
quality_gates:
  - typecheck
  - test
inputs:
  - knowledge/DESIGN-TOKENS.md
  - knowledge/DESIGN-BRIEF.md
  - stages/design/artifacts/contrast-and-type-audit.md
status: pending
bolt: 0
hat: ""
---

# Design token system

Implement the token system defined in `knowledge/DESIGN-TOKENS.md` across `packages/haiku-ui/`: tailwind config, CSS custom properties, and a typography + color + spacing primitive layer every downstream component builds on.

## Scope

- `packages/haiku-ui/tailwind.config.ts` — extend palette, radii, shadows, spacing, breakpoints per DESIGN-TOKENS §1. Explicitly remove any banned colors (raw hex, gray-* left over from pre-stone migration) from the generated class surface.
- `packages/haiku-ui/src/index.css` — CSS custom properties for light + dark theme variables; apply via `:root` and `.dark`.
- `packages/haiku-ui/src/components/primitives/` — primitive components for Button, Badge, Card, Chip, Divider, Input — typed variants matching DESIGN-TOKENS §2.
- Remove every `text-[9px]`, `text-[10px]`, banned `text-gray-*`, banned `text-stone-400/500` pair from existing source. (Runs as a grep-driven pass; every hit either deletes the class or replaces with a token-approved equivalent.)
- Remove every `opacity-50/60/70` applied to card roots, buttons, titles, metadata — per DESIGN-BRIEF §2 and DESIGN-TOKENS §1.7.
- Canonicalize sidebar width to `w-80 xl:w-96` wherever the sidebar renders.
- Canonicalize max-width to a named token (e.g. `max-w-content`) replacing literal `max-w-[1400px]`.
- Breakpoint threshold: consolidate `1024` vs `1280` drift to the brief's canonical value.

## Out of scope

- Touching component internals beyond swapping class strings (behavior changes live in per-component units).
- Writing new components.

## Completion Criteria

- Tailwind config and CSS custom-property layer match DESIGN-TOKENS.md exactly.
- Grep for banned patterns returns zero hits in `packages/haiku-ui/src/`:
  - `text-\[9px\]`, `text-\[10px\]`
  - `text-gray-[0-9]+`
  - `text-stone-(400|500)` paired with light/white backgrounds (per banned-pairs table)
  - `opacity-(50|60|70)` on root-level card/button elements
  - `max-w-\[1400px\]` literal
  - `lg:w-96` on sidebar context (use `xl:w-96`)
- Contrast audit script (`packages/haiku-ui/scripts/audit-contrast.mjs`) runs across the primitive layer and all default token pairs and passes WCAG 1.4.3 AA for text, 1.4.11 Non-Text for UI components.
- `npx tsc --noEmit` passes.
