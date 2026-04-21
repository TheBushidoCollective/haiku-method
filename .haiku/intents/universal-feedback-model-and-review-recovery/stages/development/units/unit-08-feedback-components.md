---
title: Feedback component cluster
type: implementation
depends_on:
  - unit-04-design-token-system
  - unit-05-a11y-foundations
quality_gates:
  - typecheck
  - test
inputs:
  - knowledge/DESIGN-BRIEF.md
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/state-coverage-grid.md
status: pending
bolt: 0
hat: ""
---

# Feedback component cluster

The core set of components that render feedback items in any page. Built as a coherent cluster because they share state, tokens, and a11y patterns. Each must cover the full six-state grid (default / hover / focus / active / disabled / error) per state-coverage-grid.md.

## Scope

- `packages/haiku-ui/src/components/feedback/FeedbackItem.tsx` — single feedback row: title, body excerpt, origin badge, status badge, author, timestamp, expand/collapse. Uses `aria-expanded`; focus preserved across status changes per DESIGN-BRIEF §2.
- `FeedbackList.tsx` — list with group headers (by visit), keyboard navigation (ArrowDown/Up), virtualization if >50 items.
- `FeedbackStatusBadge.tsx` — status variants: pending, addressed, closed, rejected. Color semantics per DESIGN-BRIEF §2 + DESIGN-TOKENS §2.1. `aria-label="Status: {status}"` on every instance (fixes FB-12).
- `FeedbackOriginIcon.tsx` — origin emoji per canonical map (🔍 adversarial-review, 👤 user-visual, 🧩 user-chat, 📦 external-pr, etc.); uses `{originLabels[origin]}` as visible label (fixes FB-13).
- `FeedbackSummaryBar.tsx` — count breakdown by status at the top of the list.
- All six states per component rendered and tested in a Storybook-style isolated harness.

## Out of scope

- Mobile sheet container (unit-10).
- Agent feedback toggle (unit-09).
- Annotation-canvas integration (unit-13).

## Completion Criteria

- State-coverage grid for each component passes — every cell in the default/hover/focus/active/disabled/error × status-variant matrix is rendered, tested, and visually confirmed.
- Zero use of opacity on card roots (per unit-04 enforcement + FB-46 / FB-61 regression).
- Status badges all carry `aria-label="Status: {status}"` — grep confirms parity.
- Origin icons render via `originLabels[origin]` map — grep for raw `{origin}` in templates returns zero in component source.
- Keyboard ArrowDown/Up navigates list; Enter activates the focused item.
- `npx tsc --noEmit` passes.
