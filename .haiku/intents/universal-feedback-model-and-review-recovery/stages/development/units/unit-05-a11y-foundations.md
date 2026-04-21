---
title: A11y foundations — landmarks, live regions, focus, keyboard nav
type: implementation
depends_on:
  - unit-04-design-token-system
quality_gates:
  - typecheck
  - test
inputs:
  - stages/design/artifacts/aria-landmark-spec.md
  - stages/design/artifacts/aria-live-sequencing-spec.md
  - stages/design/artifacts/keyboard-navigation-spec.md
  - stages/design/artifacts/touch-target-audit.md
  - stages/design/artifacts/motion-and-reduced-motion-spec.md
status: pending
bolt: 0
hat: ""
---

# A11y foundations

Establish the accessibility layer every feature component builds on: canonical aria-landmarks, live-region sequencing, focus-ring tokens, keyboard navigation primitives, touch-target helpers, and reduced-motion guards.

## Scope

- `packages/haiku-ui/src/a11y/landmarks.tsx` — typed shell landmarks (`<Header>`, `<Main>`, `<Aside>`, `<Nav aria-label="...">`, `<FooterBar>`) per aria-landmark-spec §1-2. Single source of truth for landmark structure; pages compose these.
- `packages/haiku-ui/src/a11y/live-regions.tsx` — `<LiveRegion id="feedback-live-polite" aria-live="polite">` and `<LiveRegion id="feedback-live-assertive" aria-live="assertive" role="alert">` mounted once in the shell. `useAnnounce(severity, message)` hook posts into them per aria-live-sequencing-spec §2.2 and §3.1.
- `packages/haiku-ui/src/a11y/focus.ts` — `focusRingClass` (canonical teal ring per focus-ring-spec), `focusVisibleOnly(...)` helper, focus-trap primitive `useFocusTrap(ref, enabled)` for modal/sheet use.
- `packages/haiku-ui/src/a11y/keyboard.ts` — keyboard-map registry per keyboard-navigation-spec. `useShortcut(key, handler, { scope })` hook with scope-conflict detection (rejects duplicate bindings at dev time).
- `packages/haiku-ui/src/a11y/touch-target.ts` — `touchTargetClass` utility that renders a transparent `::before` hit-zone of 44×44 without changing visible geometry. Applied by default to any interactive element whose visible size is < 44px.
- `packages/haiku-ui/src/a11y/reduced-motion.ts` — `useReducedMotion()` hook + `motionSafeClass` helper; pairs with token-layer transitions so every animation honors `prefers-reduced-motion: reduce`.

## Out of scope

- Applying these to specific feature components (that's per-component units).
- Adding new keyboard shortcuts beyond what the spec defines.

## Completion Criteria

- Every primitive above exists and is exported from `packages/haiku-ui/src/a11y/index.ts`.
- `useShortcut` throws (dev mode) on duplicate bindings within a scope, per keyboard-navigation-spec §4 conflict-prevention requirement.
- `useFocusTrap` correctly restores focus to the trigger on close, handles Tab/Shift+Tab wrap, ignores disabled elements.
- `touchTargetClass` passes the visual regression test (hit-zone geometry invisible, measurable with `getBoundingClientRect`).
- `useReducedMotion` reacts to `prefers-reduced-motion` media-query changes at runtime.
- A11y unit tests (`packages/haiku-ui/src/a11y/__tests__/*`) pass.
- `npx tsc --noEmit` passes.
