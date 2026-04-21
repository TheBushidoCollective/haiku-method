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
  - knowledge/DESIGN-TOKENS.md
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/aria-landmark-spec.md
  - stages/design/artifacts/skip-link-spec.html
  - stages/design/artifacts/stage-progress-strip.html
status: active
bolt: 1
hat: planner
started_at: '2026-04-21T07:26:57Z'
hat_started_at: '2026-04-21T07:26:57Z'
iterations:
  - hat: planner
    started_at: '2026-04-21T07:26:57Z'
    completed_at: null
    result: null
---
# Shell and routing refactor

Rebuild `App.tsx` as a clean shell composing a11y landmarks, theme toggle, and page-routing. Each page-type is a lazy-loaded module consuming the session from `haiku-api`.

## Scope

- `packages/haiku-ui/src/App.tsx` — theme init, landmark composition (`<Header>` / `<Main>` / `<FooterBar>`), route parse, live-region mounts, render matched page. **< 100 lines**.
- `packages/haiku-ui/src/routing/parseRoute.ts` — typed route parser returning `{ pageType: 'review'|'review-current'|'question'|'direction', sessionId: string } | null`.
- `packages/haiku-ui/src/pages/` — one folder per page-type (`review/`, `review-current/`, `question/`, `direction/`).
- `packages/haiku-ui/src/components/ThemeToggle.tsx` — aria-labeled icon-only `<button>`, `aria-label="Toggle theme"`, `touchTargetClass` applied — **regression guard for the icon-only missing-label class of issue**.
- `packages/haiku-ui/src/components/Header.tsx` — canonical app header; brand, active-intent breadcrumb, theme toggle, keyboard-shortcut-help trigger.
- Skip-to-main-content link per `skip-link-spec.html` — first in DOM order in `<Header>`, hidden until focused, jumps to `#main`. **Regression guard for missing-skip-link class of issue.**

**Lighthouse gate — pinned harness:**
- `packages/haiku-ui/scripts/audit-lighthouse.mjs` — boots the built SPA on an ephemeral port using committed fixtures, runs Lighthouse CI with version pinned in `packages/haiku-ui/package.json` (explicit `lighthouse` dep). Configuration in `packages/haiku-ui/lighthouserc.json`:
  - URLs: `/review/demo`, `/review/current`, `/question/demo`, `/direction/demo` (demo ids served by a dev-fixture server the script boots).
  - `--only-categories=accessibility`, `--preset=desktop`, `--throttling.cpuSlowdownMultiplier=1`.
  - Assertions: a11y score ≥ 0.95 per URL.

## Out of scope

- Per-page redesign (separate units).
- Annotation canvas UX (unit-13).

## Completion Criteria

- `App.tsx` < 100 lines and contains no page-specific JSX (verified by `wc -l` + grep).
- Route parser handles the four page types and returns null for unknown paths; unknown renders a 404 placeholder using landmark primitives.
- ThemeToggle has `aria-label="Toggle theme"`, switches light/dark, persists via `localStorage`.
- Skip-link renders first in tab order in every page — verified by an RTL test that presses Tab once on page load and asserts the skip link receives focus.
- Existing URL paths (`/review/:id`, `/review/current`, `/question/:id`, `/direction/:id`) render without regression (verified by the unit-03 DOM parity Playwright test, now re-run with the new shell).
- `node packages/haiku-ui/scripts/audit-lighthouse.mjs` exits 0 with a11y score ≥ 0.95 on each pinned URL.
- `npx tsc --noEmit` passes.
