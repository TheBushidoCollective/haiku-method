# unit-22 design review — modal dialog semantics & inert contract

**Hat:** design-reviewer · **Bolt:** 1 · **Outcome:** APPROVE

Scope: verify FB-74 (revisit-modal-states dialog landmarks) and FB-80
(mobile sheet inert + aria-hidden wiring) are correctly implemented and
meet the aria-landmark-spec §3 and §5 contracts.

## Contract verification

All §9 grep contracts from `aria-landmark-spec.md` pass against the two
edited files:

| Contract | Expected | Actual |
|---|---|---|
| `role="dialog" aria-modal="true" aria-labelledby=` in `revisit-modal-states.html` | ≥ 4 (one per shell) | 4 (error L438, loading L531, empty L580, long L628) |
| `role="dialog" aria-modal="true" aria-labelledby=` in `feedback-inline-mobile.html` | ≥ 1 | 1 (L178–181 sheet root) |
| `main.inert` / `setAttribute('aria-hidden'` in mobile controller | ≥ 1 each | 4 matches (L387–394) |
| `aria-haspopup="dialog"` on FAB | 1 | L132 |
| `aria-controls="feedback-sheet"` on FAB | 1 | L134 |
| `focus-trap-react` reference (dev-stage handoff) | ≥ 1 | 4 matches (L171, L363, L417, plus prose) |

## FB-74 checks (revisit-modal-states.html)

- Every modal shell container renders
  `role="dialog" aria-modal="true" aria-labelledby="{id}"` —
  error / loading / empty / long-content all covered.
- Loading shell additionally carries `aria-busy="true"` on the dialog
  root per §3 optional attribute (correctly paired with suppressed
  Escape + backdrop per footer text).
- `aria-labelledby` targets match visible `<h3>` heading ids:
  `revisit-states-{error,loading,empty,long}-title`.
- `aria-describedby` targets match visible `<p>` ids:
  `revisit-states-{error,loading,empty,long}-desc`.
- §Modal lifecycle (L303–425) documents the inert + aria-hidden pairing
  on `<main>`, `<header>`, `<nav>` and cites `aria-landmark-spec.md §3.7`.
- New state-matrix table (L342–417) enumerates phase × DOM/attribute
  state across Idle, Opening, Open+interactive, Loading, Closing, Closed
  — matches §5.4 of the spec.
- The mid-commit rollback "Review UI (reverted)" panel stays as-is; it's
  intentionally not a dialog, illustrating the post-close review surface.
  Rollback toast carries `role="status" aria-live="polite"` per spec.
- ↩ glyph in each modal header is `aria-hidden="true"` so the accessible
  name is the heading text alone — correct per §6 emoji ARIA policy.

## FB-80 checks (feedback-inline-mobile.html)

- Inline `onclick="…"` handlers removed from FAB and close button.
- FAB uses `data-feedback-sheet-trigger` marker attribute; close button
  uses `data-feedback-sheet-close`.
- Sheet ships with the `hidden` attribute so initial render matches the
  closed state.
- `<script data-feedback-sheet-controller>` (L374–435) implements real
  behavior, not narrative:
  - `lockBackground()` — sets `main.inert = true` + `aria-hidden="true"`
    on `<main>` and `<header role="banner">`.
  - `unlockBackground()` — reverses both on close.
  - `openSheet()` — removes `[hidden]`, flips `aria-expanded="true"`,
    locks background, moves focus to `#sheet-first-tab`, installs
    Escape listener.
  - `closeSheet()` — adds `[hidden]`, flips `aria-expanded="false"`,
    unlocks background, removes Escape listener, returns focus to FAB.
  - Escape listener scoped to `document` while sheet is open.
- Dev-stage handoff note (L169–175, L362–364) tells React to replace the
  vanilla controller with `<FocusTrap active returnFocusOnDeactivate>`
  from `focus-trap-react` wrapping `<MobileFeedbackPanel>`; the inert +
  aria-hidden apparatus stays as wired.
- Theme-toggle `onclick` at L68 is intentionally preserved — it's out of
  unit-22 scope (FB-80 is specifically about the sheet open/close path).

## Design-system consistency

- Every color reference uses named Tailwind tokens (stone, amber, teal,
  red, sky, blue, green, rose, violet) — no raw hex values introduced.
- Focus rings use canonical teal-500 ring + offset per
  `focus-ring-spec.html §1`.
- Dark-mode variants present on every surface (`dark:` prefixes).
- 44×44 touch targets enforced on mobile interactive elements
  (`.touch-target` utility + explicit `min-h-[44px]` where needed).

## State coverage (design-reviewer RFC 2119 MUST checks)

- All interactive states covered: default, hover, focus, active,
  disabled, loading, error, empty, long-content — confirmed by the
  state-matrix summary table (L716–770).
- Error state: inline `role="alert"` banner + retry button.
- Loading state: dialog-root `aria-busy="true"` + disabled controls +
  suppressed Escape/backdrop.
- Empty state: "no active gate" chip + fallback-to-current-stage target.
- Long-content: scrolling body with pinned footer; list truncates to
  12 + "… N more" link.
- Reduced-motion: `@media (prefers-reduced-motion: reduce)` disables
  scale transform + spinner rotation + toast slide.

## Pre-existing items (out of unit-22 scope — not blocking)

- `feedback-inline-mobile.html` L326 contains an orphan
  `</div><!-- /tabpanel -->` with no matching opening tag. Predates this
  commit (verified via `git show f5bcd618~1`). Belongs to a future
  cleanup unit; not in FB-74 or FB-80 scope.

## Verdict

APPROVE. Every completion-criteria item on the unit spec is satisfied;
every `aria-landmark-spec.md` §9 grep contract passes; dialog +
inert + aria-hidden contracts are correctly wired end-to-end for both
artifacts with a clear dev-stage handoff to `focus-trap-react`.
