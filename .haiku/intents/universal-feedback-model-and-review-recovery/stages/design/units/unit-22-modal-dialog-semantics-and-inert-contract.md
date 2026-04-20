---
title: >-
  Modal dialog semantics + inert contract — revisit-modal-states every shell
  renders role=dialog, feedback-inline-mobile wires real inert/aria-hidden
  open-close handlers
type: design
closes:
  - FB-74
  - FB-80
depends_on:
  - unit-19-component-a11y-fixes
inputs:
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/revisit-modal-spec.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/aria-landmark-spec.md
outputs:
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/feedback-inline-mobile.html
quality_gates:
  - >-
    `revisit-modal-states.html` — every modal-shell container renders the full
    dialog landmark contract: `role="dialog" aria-modal="true"
    aria-labelledby="{unique-id}"` and a matching visible heading carrying that
    id. Covers the error, loading, empty, and long-content variants in §Error,
    §Loading, §Empty, and §Long-content sections. Verification: `grep -cE
    'role="dialog"|aria-modal|aria-labelledby'
    stages/design/artifacts/revisit-modal-states.html` returns ≥ 8 (was 0; see
    FB-74).
  - >-
    `revisit-modal-states.html` — §Modal lifecycle documents the inert +
    aria-hidden apparatus: on open, `<main id="main-content">`, `<header
    role="banner">`, and `<nav aria-label="Stage progress">` receive both
    `inert` and `aria-hidden="true"`; on close, both are removed. focus-trap
    strategy cites `focus-trap-react` (library, not hand-rolled). An inert +
    aria-hidden state-matrix table enumerates the DOM/attribute state for each
    phase (idle, opening, open, loading, closing, closed).
  - >-
    `feedback-inline-mobile.html` — the dialog open/close behavior is wired as
    a real `<script data-feedback-sheet-controller>` block at the bottom of the
    document, not a `/* dev stage: … */` comment. The script (a) sets
    `main.inert = true` and `main.setAttribute('aria-hidden', 'true')` on
    `<main id="main-content">` and `<header role="banner">` on open, (b)
    reverses both on close, (c) flips the FAB's `aria-expanded`, (d) moves
    focus into the sheet on open and restores it to the FAB on close, (e)
    installs an Escape-key listener scoped to the sheet. Verification: `grep
    -nE 'main.*\.inert|setAttribute\(.aria-hidden'
    stages/design/artifacts/feedback-inline-mobile.html` hits both the open
    and close paths (≥ 4 matches in the controller); FB-22/FB-51/FB-80 all
    satisfied.
  - >-
    Neither artifact hand-rolls a focus trap; both cite `focus-trap-react`
    (https://github.com/focus-trap/focus-trap-react) — the same library
    already referenced by annotation-popover-states.html — as the dev-stage
    implementation. A dev-stage handoff comment in
    `feedback-inline-mobile.html` explains that the vanilla controller is
    replaced by `<FocusTrap active returnFocusOnDeactivate>` wrapping
    `<MobileFeedbackPanel>`; the inert + aria-hidden apparatus on background
    landmarks stays as wired.
---
# Modal dialog semantics & inert contract

## Scope

Two feedback items describe one family of defects: the revisit-modal-states
artifact ships zero dialog landmarks on its modal shells (FB-74), and the
mobile feedback sheet's open/close handlers narrate the inert + aria-hidden
behavior in `/* dev stage: … */` comments instead of wiring it (FB-80).

Both defects violate `aria-landmark-spec.md §3` (every modal carries
`role="dialog" aria-modal="true" aria-labelledby`) and §5 (the
MobileFeedbackPanel's open/close lifecycle includes `inert` +
`aria-hidden="true"` on background landmarks).

**FB-to-fix mapping:**

- **FB-74** (revisit-modal-states has zero dialog/aria-modal/labelledby): add
  the full dialog contract to every modal shell — error, loading, empty,
  long-content. Each container gains `role="dialog" aria-modal="true"
  aria-labelledby="{unique-id}"` and the matching heading gains the referenced
  id. Also document the inert contract in §Modal lifecycle and add a state
  matrix table so dev-stage has the complete picture.
- **FB-80** (mobile sheet's inert/aria-hidden handlers are comments): promote
  the narrative to a real `<script data-feedback-sheet-controller>` block
  that actually wires `main.inert = true` + `setAttribute('aria-hidden',
  'true')` on open and reverses on close. Move the onclick handlers off the
  FAB and close button; the controller handles everything. Dev-stage handoff
  note tells the React implementation to replace the vanilla controller with
  `<FocusTrap active returnFocusOnDeactivate>` — the inert apparatus stays.

## Approach

The designer hat will:

1. **revisit-modal-states.html (FB-74)**:
   - Add `role="dialog" aria-modal="true" aria-labelledby="{id}"` +
     matching `id` on the heading for the error, loading, empty, and
     long-content modal shells.
   - Loading shell also carries `aria-busy="true"` on the dialog root.
   - Update the §Modal lifecycle section to document the inert +
     aria-hidden pairing and reference `aria-landmark-spec.md §3.7`.
   - Add a "Inert + aria-hidden contract — state matrix" table that
     enumerates DOM/attribute state per phase.
   - The post-close "reverted" review-UI panel in §Failure-on-confirm
     stays as-is — it is not an active dialog; it illustrates what the
     review UI looks like AFTER the modal closed and state rolled back.
     The rollback toast already carries `role="status" aria-live="polite"`.

2. **feedback-inline-mobile.html (FB-80)**:
   - Remove inline `onclick="…"` attributes from the FAB and the close
     button. Replace with `data-feedback-sheet-trigger` and
     `data-feedback-sheet-close` marker attributes.
   - Start the sheet with the `hidden` attribute so the initial render
     matches the "closed" state.
   - Add `<script data-feedback-sheet-controller>` at the bottom of the
     document implementing `openSheet`, `closeSheet`, and an Escape
     listener. The controller sets `main.inert = true` and
     `main.setAttribute('aria-hidden', 'true')` on `<main>` and
     `<header>` on open; reverses both on close; flips the FAB's
     `aria-expanded`; moves focus to `#sheet-first-tab` on open and
     returns it to `#feedback-fab` on close.
   - Dev-stage handoff comment at the top of the sheet explains the
     vanilla controller is replaced by `<FocusTrap active
     returnFocusOnDeactivate>` wrapping `<MobileFeedbackPanel>` — the
     inert + aria-hidden apparatus on background landmarks stays
     exactly as wired.

## Completion criteria

- [x] Every modal shell in `revisit-modal-states.html` carries
      `role="dialog" aria-modal="true" aria-labelledby="{id}"`
- [x] Every dialog labelledby target has a matching `id` on a visible
      heading inside the dialog
- [x] §Modal lifecycle documents the inert + aria-hidden pairing and
      cites `aria-landmark-spec.md §3.7`
- [x] Inert state-matrix table enumerates DOM/attribute state per phase
- [x] `feedback-inline-mobile.html` removes onclick comments and adds a
      real `<script data-feedback-sheet-controller>` block that actually
      sets `main.inert` + `setAttribute('aria-hidden')`
- [x] Dev-stage handoff note tells React to swap the vanilla controller
      for `<FocusTrap active returnFocusOnDeactivate>`
- [x] Grep contracts from `aria-landmark-spec.md §9` pass for both files
- [x] FB-74 and FB-80 both verified by feedback-assessor
