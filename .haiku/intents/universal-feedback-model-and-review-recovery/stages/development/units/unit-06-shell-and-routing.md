---
title: Shell and routing refactor
type: implementation
depends_on:
  - unit-04-design-token-system
  - unit-05-a11y-foundations
quality_gates:
  - typecheck
  - test
inputs:
  - knowledge/DESIGN-BRIEF.md
  - stages/design/artifacts/stage-progress-strip.html
status: pending
bolt: 0
hat: ""
---

# Shell and routing refactor

Rebuild `App.tsx` as a clean shell that composes the a11y landmarks, theme toggle, and page-routing logic. Each page-type is a lazy-loaded module consuming the session from `haiku-api`.

## Scope

- `packages/haiku-ui/src/App.tsx` — reduced to: theme init, landmark composition (`<Header>` / `<Main>` / `<FooterBar>`), route parse, live-region mounts, render matched page.
- `packages/haiku-ui/src/routing/parseRoute.ts` — extracted route parser returning typed `{ pageType, sessionId }`, typed discriminated union over `'review' | 'review-current' | 'question' | 'direction' | null`.
- `packages/haiku-ui/src/pages/` — one folder per page-type (`review/`, `review-current/`, `question/`, `direction/`). Each exports a `<Page>` component and a `useSession` specialization typed to its session schema from `haiku-api`.
- `packages/haiku-ui/src/components/ThemeToggle.tsx` — aria-labeled icon-only button (fixes FB-66 reported in the design revisit). Uses `touchTargetClass` from a11y foundations.
- `packages/haiku-ui/src/components/Header.tsx` — canonical app header with brand, active-intent breadcrumb, theme toggle, keyboard-shortcut help.
- Skip-to-main-content link inside `<Header>` per aria-landmark-spec §7 (addresses FB-30).

## Out of scope

- Per-page redesign of Review / Question / Direction content — separate units.
- Annotation canvas UX — separate unit.

## Completion Criteria

- `App.tsx` is < 100 lines and contains no page-specific JSX.
- Every page is mounted via the route parser; unknown routes render a 404 placeholder using landmark primitives.
- Theme toggle has `aria-label="Toggle theme"`, switches light/dark, persists to `localStorage`.
- Skip-to-main-content link renders first in tab order in every page, hidden until focused.
- Existing URL paths (`/review/:id`, `/review/current`, `/question/:id`, `/direction/:id`) render without regression.
- `npx tsc --noEmit` passes.
- Lighthouse a11y score on the built bundle ≥ 95.
