---
title: Annotation canvas UX
type: implementation
depends_on:
  - unit-05-a11y-foundations
  - unit-07-review-page-desktop-and-mobile
quality_gates:
  - typecheck
  - test
inputs:
  - stages/design/artifacts/annotation-popover-states.html
  - knowledge/DESIGN-BRIEF.md
status: pending
bolt: 0
hat: ""
---

# Annotation canvas UX

Pin-drop + popover UX for annotating stage artifacts (mockups, wireframes). Fixes FB-17 (pin markers at tabindex="-1" making keyboard users unable to annotate).

## Scope

- `packages/haiku-ui/src/pages/review/AnnotationCanvas.tsx`:
  - Overlay layer on top of `ArtifactsPane` that captures pointer + keyboard events.
  - Pin markers as `<button>` elements (not `<div>`), keyboard-activatable.
  - Popover on click/focus with feedback-draft form; Zod-validated against `haiku-api` feedback-create schema.
  - Draft persistence debounced to localStorage to survive navigation (fixes prior pre-design data loss).
  - Keyboard: N to start new annotation at a named anchor, Arrow keys to move focus between pins, Esc to cancel draft, Enter to save.
  - Keyboard shortcuts registered via `useShortcut` with scope `annotation-canvas` — conflict-checked against global shortcut map.

## Out of scope

- Feedback storage (handled by `haiku_feedback` tool on backend — already shipped).

## Completion Criteria

- Keyboard user can: tab to canvas, press N to start annotation at current focus anchor, fill popover, press Enter to save, tab between existing pins via Arrow keys.
- Pin markers have `tabindex="0"` (grep for `tabindex="-1"` on pin elements returns zero).
- Draft survives page reload (localStorage).
- Popover dismisses on Esc and focus returns to the pin.
- Popover has `role="dialog"` + `aria-labelledby` pointing to its title.
- `npx tsc --noEmit` passes.
