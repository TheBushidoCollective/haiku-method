---
title: FeedbackSheet — mobile dialog semantics + focus trap
type: implementation
depends_on:
  - unit-05-a11y-foundations
  - unit-08-feedback-components
quality_gates:
  - typecheck
  - test
inputs:
  - knowledge/DESIGN-BRIEF.md
  - stages/design/artifacts/feedback-inline-mobile.html
status: pending
bolt: 0
hat: ""
---

# FeedbackSheet — mobile bottom sheet

Proper dialog semantics + focus trap + background inert on the mobile feedback sheet. Fixes FB-22 / FB-51 regression (prior implementation omitted dialog role and focus trap).

## Scope

- `packages/haiku-ui/src/components/feedback/FeedbackSheet.tsx`:
  - Uses native `<dialog>` element with `role="dialog"` and `aria-modal="true"`.
  - `aria-labelledby` points to the sheet's title; `aria-describedby` optional summary.
  - Open/close via `dialog.showModal()` / `dialog.close()` — native focus trap + inert-background handled by the platform.
  - Fallback focus trap via `useFocusTrap` (from a11y foundations) for browsers without `<dialog>` support.
  - Backdrop `::backdrop` styled per design, dismissable via click outside OR Escape key.
  - FeedbackFloatingButton (FAB) is the trigger; focus returns to the FAB on close.
  - Reduced-motion respected — slide-up animation disabled under `prefers-reduced-motion`.

## Out of scope

- FeedbackList/FeedbackItem internals (unit-08).
- AgentFeedbackToggle inside the sheet (unit-09 — composed here).

## Completion Criteria

- Focus on open lands on first focusable element inside the sheet (not the dialog itself).
- Tab cycles only inside the sheet; Shift+Tab from the first focusable wraps to the last, and vice versa.
- Escape closes; click on backdrop closes.
- Focus returns to FAB trigger on close.
- Background content is `inert` while sheet is open — confirmed by a11y test that tries to reach body buttons via Tab.
- Screen reader announces "Feedback, dialog" on open.
- `npx tsc --noEmit` passes.
