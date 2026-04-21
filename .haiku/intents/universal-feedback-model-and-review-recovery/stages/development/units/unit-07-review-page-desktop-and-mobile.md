---
title: Review page — desktop + mobile
type: implementation
depends_on:
  - unit-06-shell-and-routing
quality_gates:
  - typecheck
  - test
inputs:
  - knowledge/DESIGN-BRIEF.md
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/comment-to-feedback-flow.html
  - stages/design/artifacts/state-coverage-grid.md
status: pending
bolt: 0
hat: ""
---

# Review page — desktop + mobile

Rebuild the review page (the main review pane: stage artifacts + feedback list + annotation canvas + footer actions) to match DESIGN-BRIEF §3-4 and the updated mockups. Desktop and mobile layouts share components but compose differently.

## Scope

- `packages/haiku-ui/src/pages/review/ReviewPage.tsx` — top-level composition: `ArtifactsPane` + `FeedbackSidebar` (desktop) or `FeedbackSheet` (mobile).
- `packages/haiku-ui/src/pages/review/ArtifactsPane.tsx` — render stage artifacts (mockups, wireframes, stage-artifacts) per session payload; annotation overlay layer.
- `packages/haiku-ui/src/pages/review/FooterBar.tsx` — canonical footer buttons using the DESIGN-BRIEF §2 verb matrix (`Dismiss`, `Verify & Close`, `Reopen` — NOT banned verbs). Wired to `haiku-api` review-decide route.
- Responsive layout: `xl:flex` desktop split (artifacts left, sidebar `w-80 xl:w-96` right), `flex-col` mobile with sheet triggered from FAB.
- Status-badge announcements via `useAnnounce('polite', ...)` on state change.

## Out of scope

- Annotation canvas interactions (unit-13).
- FeedbackList/FeedbackItem components (unit-08).
- FeedbackSheet mobile dialog semantics (unit-10).
- AgentFeedbackToggle (unit-09).

## Completion Criteria

- ReviewPage renders at both `/review/:id` and `/review/current` with no layout drift vs the design mockups (visual diff ≤ 2px tolerance).
- Footer buttons use only canonical verbs. Grep confirms zero occurrences of "Reject", standalone "Close", "Address" in the page + components.
- Responsive breakpoints match the brief's canonical thresholds.
- Every interactive element has visible focus ring from `focusRingClass`.
- Sidebar + sheet render identical data (via shared FeedbackList in unit-08); layout diverges only in container.
- `npx tsc --noEmit` passes.
