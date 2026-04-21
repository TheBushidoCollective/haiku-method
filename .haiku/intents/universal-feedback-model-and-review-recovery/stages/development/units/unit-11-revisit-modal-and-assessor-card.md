---
title: RevisitModal + AssessorSummaryCard
type: implementation
depends_on:
  - unit-05-a11y-foundations
  - unit-06-shell-and-routing
quality_gates:
  - typecheck
  - test
inputs:
  - stages/design/artifacts/revisit-modal-spec.html
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/feedback-assessor-ux-flow.html
status: pending
bolt: 0
hat: ""
---

# RevisitModal + AssessorSummaryCard

Two modal-adjacent components grouped because both need proper dialog / live-region semantics.

## Scope

**`packages/haiku-ui/src/components/RevisitModal.tsx`:**
- Native `<dialog>` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- Collects revisit reasons (feedback-like body with title/body per pair) and posts to `haiku-api` revisit endpoint.
- Field-level validation using `haiku-api` revisit-request schema; Zod-driven error display.
- Focus trap, Escape to close, focus return to trigger.

**`packages/haiku-ui/src/components/AssessorSummaryCard.tsx`:**
- `role="status"` `aria-live="polite"` on the card root (fixes FB-35 / FB-62 regression).
- Renders feedback-assessor outcome (closed / still-open / rejected counts + per-finding status).
- Announces transitions (e.g., "5 of 14 findings addressed") on count changes.
- Visual state per assessor-summary-card.html — no opacity on card root.

## Out of scope

- The feedback-assessor fix loop logic itself (MCP-side, not in scope for UI).

## Completion Criteria

- RevisitModal opens with correct focus behavior and closes via Escape / backdrop / cancel button.
- RevisitModal form validation rejects empty reasons array, empty title, empty body per haiku-api schema.
- RevisitModal successful submit posts to correct endpoint and closes on 200.
- AssessorSummaryCard has `role="status" aria-live="polite"` on the root `<article>`.
- Count transitions trigger an announce event that SR users can hear (verified via headless a11y test).
- Zero opacity classes on either component's card root.
- `npx tsc --noEmit` passes.
