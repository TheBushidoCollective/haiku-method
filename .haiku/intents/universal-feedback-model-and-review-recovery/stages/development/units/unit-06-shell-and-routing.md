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
status: pending
bolt: 0
hat: ""
outputs:
  - stages/development/artifacts/unit-06-tactical-plan.md
  - package-lock.json
  - packages/haiku-ui/package.json
  - packages/haiku-ui/index.html
  - packages/haiku-ui/src/App.tsx
  - packages/haiku-ui/src/main.tsx
  - packages/haiku-ui/src/theme.ts
  - packages/haiku-ui/src/routing/parseRoute.ts
  - packages/haiku-ui/src/routing/__tests__/parseRoute.test.ts
  - packages/haiku-ui/src/components/SkipLink.tsx
  - packages/haiku-ui/src/components/Header.tsx
  - packages/haiku-ui/src/components/ThemeToggle.tsx
  - packages/haiku-ui/src/components/DesignPicker.tsx
  - packages/haiku-ui/src/components/__tests__/ThemeToggle.test.tsx
  - packages/haiku-ui/src/pages/index.ts
  - packages/haiku-ui/src/pages/review/index.tsx
  - packages/haiku-ui/src/pages/review-current/index.tsx
  - packages/haiku-ui/src/pages/question/index.tsx
  - packages/haiku-ui/src/pages/direction/index.tsx
  - packages/haiku-ui/src/shell/ShellLayout.tsx
  - packages/haiku-ui/src/shell/PageTitleContext.tsx
  - packages/haiku-ui/tests/parity.spec.tsx
  - packages/haiku-ui/tests/skip-link.spec.tsx
  - packages/haiku-ui/tests/a11y-pages.spec.tsx
  - packages/haiku-ui/tests/__snapshots__/parity.spec.tsx.snap
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

**Per-page axe-core gate — jsdom harness:**
- `packages/haiku-ui/tests/a11y-pages.spec.tsx` — renders `<App>` for each of the four routes (`/review/:id`, `/review/current`, `/question/:id`, `/direction/:id`) with the committed fixtures and a mocked `ApiClient`, then runs `axe.run(container)` with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.
- Assertion: **zero** violations per route. (Supersedes the former Lighthouse ≥ 0.95 gate. chrome-launcher clobbered the contributor's local Chrome profile, so Lighthouse was removed. axe-core runs the same rule engine Lighthouse uses for its a11y category, and "zero violations" is strictly stronger than "score ≥ 0.95".)
- `color-contrast` rule is disabled here (jsdom cannot compute used colors) and covered by the dedicated contrast audit in unit-11.
- `iframes: false` — axe cannot message jsdom iframes; the `direction` page preview iframe contents are audited separately.

## Out of scope

- Per-page redesign (separate units).
- Annotation canvas UX (unit-13).

## Completion Criteria

- `App.tsx` < 100 lines and contains no page-specific JSX (verified by `wc -l` + grep).
- Route parser handles the four page types and returns null for unknown paths; unknown renders a 404 placeholder using landmark primitives.
- ThemeToggle has `aria-label="Toggle theme"`, switches light/dark, persists via `localStorage`.
- Skip-link renders first in tab order in every page — verified by an RTL test that presses Tab once on page load and asserts the skip link receives focus.
- Existing URL paths (`/review/:id`, `/review/current`, `/question/:id`, `/direction/:id`) render without regression (verified by the unit-03 DOM parity Playwright test, now re-run with the new shell).
- `npx vitest run tests/a11y-pages.spec.tsx` exits 0 with zero axe-core violations across tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` for each of the four routes.
- `npx tsc --noEmit` passes.
