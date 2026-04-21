---
title: Question page + Direction page refactors
type: implementation
depends_on:
  - unit-06-shell-and-routing
  - unit-04-design-token-system
  - unit-05-a11y-foundations
quality_gates:
  - typecheck
  - test
inputs:
  - knowledge/DESIGN-BRIEF.md
  - stages/design/artifacts/state-signaling-inventory.html
status: pending
bolt: 0
hat: ""
---

# Question page + Direction page refactors

Bring the other two session-typed pages (`/question/:id`, `/direction/:id`) onto the new design foundation. Both are simpler than review, grouped into one unit.

## Scope

**`packages/haiku-ui/src/pages/question/QuestionPage.tsx`:**
- Renders the visual question payload from `haiku-api` question-session schema.
- Image carousel (when multiple images) with keyboard arrow support.
- Response form (multi-choice or free-text per question type); validated via `haiku-api` question-answer schema.
- Submits via typed `ApiClient`, closes on 200, announces completion via live-region.

**`packages/haiku-ui/src/pages/direction/DirectionPage.tsx`:**
- Renders design-direction options from the direction-session schema.
- Card grid with preview images; each card is a `<button role="radio">` in a `role="radiogroup"`.
- Parameter sliders (card density, group-by-visit, origin badge) using canonical Input primitive from the token layer.
- Comment + annotations fields optional; submitted together via direction-select endpoint.

## Out of scope

- Any changes to the question/direction payload shapes (that's haiku-api's job).

## Completion Criteria

- Both pages render real session payloads from a running MCP with zero visual regression vs the design mockups.
- Keyboard navigation: Tab reaches all interactive elements; Arrow keys navigate carousel + radiogroup.
- `aria-label` or `aria-labelledby` on every control.
- All text meets WCAG 1.4.3 AA per the design token system.
- `npx tsc --noEmit` passes.
