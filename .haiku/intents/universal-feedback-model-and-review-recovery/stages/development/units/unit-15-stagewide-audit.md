---
title: Stage-wide audit — contrast, state coverage, banned patterns
type: audit
depends_on:
  - unit-07-review-page-desktop-and-mobile
  - unit-08-feedback-components
  - unit-09-agent-feedback-toggle
  - unit-10-feedback-sheet-mobile
  - unit-11-revisit-modal-and-assessor-card
  - unit-12-stage-progress-strip
  - unit-13-annotation-canvas
  - unit-14-question-and-direction-pages
quality_gates:
  - typecheck
  - test
  - build
inputs:
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/touch-target-audit.md
  - stages/design/artifacts/motion-and-reduced-motion-spec.md
status: pending
bolt: 0
hat: ""
---

# Stage-wide audit

Single final unit that runs the full audit surface after every component unit lands. Gates: contrast, state coverage, touch targets, banned patterns, reduced-motion, live-region plumbing.

## Scope

- **Contrast audit** — every token pair used on any surface passes WCAG 1.4.3 AA for text, 1.4.11 Non-Text for UI components. Script: `packages/haiku-ui/scripts/audit-contrast.mjs` walks the rendered DOM via headless browser and measures every foreground/background pair.
- **State coverage** — every §2 component in DESIGN-BRIEF renders default/hover/focus/active/disabled/error × status-variants per state-coverage-grid.md. Storybook-style snapshot test covers the matrix.
- **Touch-target audit** — every interactive element measures ≥44×44 via computed bounding rect. Script: `packages/haiku-ui/scripts/audit-touch-targets.mjs`.
- **Banned patterns** — grep sweep confirms zero occurrences of:
  - `text-\[9px\]`, `text-\[10px\]` outside approved exemptions
  - `text-gray-\d+` anywhere
  - Banned stone-400/500 pairs on light/white backgrounds
  - `opacity-(50|60|70)` on card/button roots
  - `focus:ring-1` (canonical is `focus-visible:ring-2`)
  - Standalone "Reject", "Close", "Address" as button labels (canonical verbs: Dismiss, Verify & Close, Reopen)
  - Hyphenated "Re-open" (canonical is "Reopen")
  - Raw hex color values
  - `max-w-\[1400px\]` literal
  - `lg:w-96` on sidebar context
- **Reduced-motion** — every animation declares `@media (prefers-reduced-motion: reduce)` override or uses `motionSafeClass` helper.
- **Live-region plumbing** — `#feedback-live-polite` and `#feedback-live-assertive` mounted exactly once in the shell; `useAnnounce` targets only those IDs.
- **Keyboard-navigation spec compliance** — every shortcut in keyboard-navigation-spec.md is wired via `useShortcut`; no scope conflicts.
- **OpenAPI ↔ runtime parity** — every endpoint described in `haiku-api/dist/openapi.json` is reachable against a running MCP; every MCP route has a matching OpenAPI entry.

## Out of scope

- Any new feature work (all component/page units must have landed first).

## Completion Criteria

- All audit scripts exit 0.
- All snapshot tests pass.
- `npx tsc --noEmit` passes repo-wide.
- `npm test` passes repo-wide.
- Lighthouse a11y score on built bundle ≥ 95.
- OpenAPI spec + MCP route surface reconciled (zero drift).
