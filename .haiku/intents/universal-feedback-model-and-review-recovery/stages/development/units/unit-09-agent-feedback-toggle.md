---
title: AgentFeedbackToggle (role=switch, canonical aria-label, 44px target)
type: implementation
depends_on:
  - unit-04-design-token-system
  - unit-05-a11y-foundations
quality_gates:
  - typecheck
  - test
inputs:
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/comments-list-with-agent-toggle.html
status: pending
bolt: 0
hat: ""
---

# AgentFeedbackToggle

Dedicated unit because the prior implementation shipped a div-label masquerading as a switch (FB-32 / FB-53 regression). Proper toggle semantics, canonical aria-label, 44×44 hit area, reduced-motion animation guard.

## Scope

- `packages/haiku-ui/src/components/feedback/AgentFeedbackToggle.tsx`:
  - Native `<button type="button" role="switch" aria-checked="false">` (default OFF per DESIGN-BRIEF §2).
  - `aria-label="Show agent feedback inline"` — exact canonical string, no drift. Grep rule enforces.
  - Visible count chip when OFF: `text-[11px] font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-200` (exemption-approved).
  - 44×44 hit area via `touchTargetClass` from a11y foundations.
  - Focus ring via `focusRingClass`.
  - Switch toggle animation gated by `useReducedMotion()`.
  - Announce state change via `useAnnounce('polite', 'Agent feedback now visible' | 'Agent feedback hidden')`.

## Out of scope

- The feedback list's render-when-enabled behavior (handled in unit-07 / unit-08 cluster integration).

## Completion Criteria

- Keyboard: Space or Enter toggles when focused. Tab reaches it in the expected position.
- Screen reader announces as "Show agent feedback inline, switch, off/on".
- `aria-checked` toggles between "true" and "false" strings.
- Default state on page load is `aria-checked="false"`.
- Grep for the exact string `"Show agent feedback inline"` matches every AgentFeedbackToggle render — and grep for `"Show agent feedback"` without `inline` returns zero (FB-10 regression guard).
- Touch target is 44×44 regardless of visual glyph size.
- Animation disabled under `prefers-reduced-motion: reduce`.
- `npx tsc --noEmit` passes.
