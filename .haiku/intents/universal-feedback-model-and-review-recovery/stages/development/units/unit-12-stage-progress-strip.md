---
title: StageProgressStrip — 44px targets, full keyboard reach
type: implementation
depends_on:
  - unit-04-design-token-system
  - unit-05-a11y-foundations
quality_gates:
  - typecheck
  - test
inputs:
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/touch-target-audit.md
status: pending
bolt: 0
hat: ""
---

# StageProgressStrip

Visible navigation of the intent's stage progression. Fixes FB-07 (hit area), FB-14 (upcoming-stage contrast), FB-65 (future stages unreachable by keyboard).

## Scope

- `packages/haiku-ui/src/components/StageProgressStrip.tsx`:
  - `<nav aria-label="Stage progress">` wrapper.
  - Each stage node is a `<button>` (not a div) — tabbable, activates on Enter/Space.
  - Visible glyph per state: ✓ (completed), ◆ (in-progress), ○ (upcoming); color tokens per design.
  - 44×44 hit zone on every node via `touchTargetClass` (hidden `::before`); visible glyph unchanged.
  - Upcoming-stage border/glyph contrast meets WCAG 1.4.11 (≥3:1) — `border-stone-400 dark:border-stone-500`, `text-stone-600 dark:text-stone-300`.
  - Future stages are keyboard-reachable (no `tabindex="-1"`); clicking a future stage is disabled (visual dimming + `aria-disabled="true"`) but focus is allowed.
  - Desktop, mobile, revisit, and all-completed variants all share the same node primitive.

## Out of scope

- The underlying stage state fetching / routing (consumed from session payload).

## Completion Criteria

- Every stage node's computed hit-zone from `getBoundingClientRect()` is ≥ 44×44.
- Keyboard Tab reaches every stage node in DOM order (grep `tabindex="-1"` in stage nodes returns zero).
- Upcoming-stage contrast passes WCAG 1.4.11 (verified by contrast audit script).
- Visible glyph geometry per design: 20×20 circle, 22×22 diamond, same as design mockup.
- `aria-current="step"` set on the in-progress node.
- `npx tsc --noEmit` passes.
