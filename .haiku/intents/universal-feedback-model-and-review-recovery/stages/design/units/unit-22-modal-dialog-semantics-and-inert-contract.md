---
title: >-
  Modal dialog semantics + inert/aria-hidden contract — revisit-modal-states
  dialog markup, feedback-inline-mobile open/close handlers wired (not
  commented)
type: design
closes:
  - FB-74
  - FB-80
depends_on: []
inputs:
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/revisit-modal-spec.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/aria-landmark-spec.md
outputs:
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/aria-landmark-spec.md
  - stages/design/artifacts/unit-22-review-notes.md
quality_gates:
  - >-
    Every modal-shell `<div>` in `revisit-modal-states.html` (compact default,
    loading, error, empty, focus, hover, active, disabled — every enumerated
    state) renders as `<div role="dialog" aria-modal="true"
    aria-labelledby="{unique-id}">` with a visible heading element carrying that
    id. The rollback toast at L407 retains its correct `role="status"
    aria-live="polite"` (it is a toast, not a dialog). `grep -cE
    'role="dialog"|aria-modal="true"|aria-labelledby='
    stages/design/artifacts/revisit-modal-states.html` returns ≥ 9 (matching the
    sibling `revisit-modal-spec.html` coverage).
  - >-
    `feedback-inline-mobile.html` has a first-class `<script>` block at the
    bottom of `<body>` that, on FAB click, sets `document.getElementById
    ('main-content').inert = true`, sets
    `document.getElementById('main-content').setAttribute('aria-hidden',
    'true')`, does the same for `<header>`, then moves focus to
    `#sheet-first-tab`. The close handler reverses both (removes `inert`,
    removes `aria-hidden`, returns focus to `#feedback-fab`). These behaviors
    live in the script, NOT in HTML comments. The FAB and close-button
    `onclick=` attributes no longer carry `/* dev stage: ... */` narration —
    they call the named script functions instead.
  - >-
    `feedback-inline-mobile.html` head-of-document comment block carries a
    visible pointer: `<!-- a11y contract: see aria-landmark-spec.md §3.7 for
    dialog-open/close inert+aria-hidden semantics + focus-trap-react wrapper.
    -->`. The sheet root retains the `role="dialog" aria-modal="true"
    aria-labelledby="sheet-title"` attributes already in place; the
    `data-focus-trap` marker attribute is added to the sheet root so dev stage
    can wire `<FocusTrap>` without searching.
  - >-
    `aria-landmark-spec.md §3.7` documents the dialog-open / dialog-close
    lifecycle end-to-end with a concrete before/after code snippet and names the
    specific DOM elements that receive `inert` + `aria-hidden` when any dialog
    in the app opens (`<main id="main-content">` and `<header>` at minimum;
    skip-link + live regions are exempt). §3.7 also carries the rationale:
    `aria-modal="true"` alone is insufficient on NVDA + JAWS with virtual cursor
    — inert + aria-hidden is the belt-and-suspenders fix.
  - >-
    `grep -nE 'main.*\.inert\s*=|setAttribute\(.aria-hidden.,.true.'
    stages/design/artifacts/feedback-inline-mobile.html` returns ≥ 2 matches
    (one in the open handler, one in the close handler). `grep -cE
    'role="dialog"' stages/design/artifacts/feedback-inline-mobile.html` returns
    ≥ 1. unit-19's completion-criteria grep is updated to include these two
    checks so the pattern is enforced stage-wide, not only at this unit's close.
status: active
bolt: 3
hat: design-reviewer
started_at: '2026-04-20T05:08:23Z'
hat_started_at: '2026-04-20T09:05:35Z'
iterations:
  - hat: designer
    started_at: '2026-04-20T05:08:23Z'
    completed_at: '2026-04-20T05:17:00Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T05:17:00Z'
    completed_at: '2026-04-20T05:20:05Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T05:20:05Z'
    completed_at: '2026-04-20T08:54:06Z'
    result: reject
    reason: >-
      FB-80 still-pending — script wiring at feedback-inline-mobile.html:374-435
      is correct, but FB-80's body explicitly requires a visible
      head-of-document comment pointing at aria-landmark-spec.md §3.7 so
      dev-stage inherits the contract; no such head-comment pointer exists in
      the artifact (`grep -n 'a11y contract\|§3.7' feedback-inline-mobile.html`
      returns zero). Additionally, aria-landmark-spec.md §3.7 was never authored
      (spec has no §3.7 section). FB-74 is CLOSED — all four modal shells (error
      L438, loading L531, empty L580, long-content L628) carry the full
      role=dialog + aria-modal + aria-labelledby contract with matching heading
      ids.
  - hat: designer
    started_at: '2026-04-20T08:54:06Z'
    completed_at: '2026-04-20T08:57:02Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T08:57:02Z'
    completed_at: '2026-04-20T09:00:01Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T09:00:01Z'
    completed_at: '2026-04-20T09:02:07Z'
    result: reject
    reason: >-
      Feedback content for FB-74 and FB-80 is demonstrably closed in the unit
      worktree artifacts (revisit-modal-states.html: 8
      dialog/aria-modal/aria-labelledby matches across all 4 modal shells +
      state-matrix table; feedback-inline-mobile.html: 5 main.inert/aria-hidden
      matches in a real <script data-feedback-sheet-controller> block;
      aria-landmark-spec.md §3.7 authored). However, the FSM blocks advance_hat
      with criteria_not_met (7 unchecked). Root cause: the outer intent-root
      unit spec
      (.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/units/unit-22-modal-dialog-semantics-and-inert-contract.md)
      still has all 7 original completion-criteria boxes unchecked at L167–177 —
      the prior-hat commits (designer + reviewer) updated checkboxes only on the
      unit-worktree copy, never on the FSM-visible outer-root copy. Next bolt's
      designer must tick the 7 outer-root checkboxes (or merge the worktree's
      updated spec into the outer root) so the FSM can verify advancement. The
      underlying FB-74 and FB-80 fixes are good — do not redo them.
  - hat: designer
    started_at: '2026-04-20T09:02:07Z'
    completed_at: '2026-04-20T09:05:35Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T09:05:35Z'
    completed_at: null
    result: null
---
# Modal dialog semantics + inert/aria-hidden contract

## Scope

Two findings describe modals that *claim* the dialog contract but ship
markup that either omits it entirely or narrates it as a comment:

- **FB-74**: `revisit-modal-states.html` — the state-coverage companion
  to `revisit-modal-spec.html` — contains zero `role="dialog"`,
  `aria-modal`, or `aria-labelledby` occurrences. The sibling spec file
  has ≥ 9. Dev stage will wire React against the states file; without
  dialog semantics in the reference, the shipped modals lose screen-
  reader dialog mode, focus-return-on-close, and the anchor element for
  `focus-trap-react` to bind to.
- **FB-80**: `feedback-inline-mobile.html` correctly declares
  `role="dialog" aria-modal="true"` on the sheet root but leaves the
  critical `main.inert = true` + `main.setAttribute('aria-hidden',
  'true')` behavior as `/* dev stage: ... */` narration inside
  `onclick=` attributes. NVDA + JAWS with virtual cursor will read
  through the background content unless both are wired. `aria-modal`
  alone is not enough on Windows screen readers.

## Approach

Designer hat:

1. **FB-74 fix**: walk every enumerated state in
   `revisit-modal-states.html` (default, hover, focus, active, disabled,
   loading, error, empty). For each modal-shell `<div>`, convert to
   `<div role="dialog" aria-modal="true" aria-labelledby="{unique-id}">`
   and ensure a visible heading element carries that id. The rollback
   toast at L407 stays as `role="status" aria-live="polite"` (toast,
   not dialog). Mirror the coverage of the sibling `revisit-modal-
   spec.html`.
2. **FB-80 fix**: add a first-class `<script>` block at the bottom of
   `feedback-inline-mobile.html`'s `<body>` implementing `openSheet()`
   and `closeSheet()` functions that set/unset `.inert` and
   `aria-hidden` on `<main id="main-content">` and `<header>`, move
   focus on open, return focus on close. Replace the `onclick=` `/*
   dev stage: ... */` comments with calls to these functions. Add the
   `data-focus-trap` marker attribute to the sheet root.
3. **FB-80 cross-link**: add a head-of-document HTML comment in
   `feedback-inline-mobile.html` pointing at
   `aria-landmark-spec.md §3.7`.
4. **aria-landmark-spec.md §3.7 update**: document the dialog-open /
   dialog-close lifecycle with a concrete before/after code snippet,
   name the specific DOM elements that receive `inert` + `aria-hidden`,
   and carry the rationale about NVDA/JAWS + virtual cursor.

Design-reviewer hat runs the grep commands from the gate prose and
confirms each returns the expected count.

Feedback-assessor hat walks FB-74 against `revisit-modal-states.html`
(dialog-markup count ≥ 9) and FB-80 against
`feedback-inline-mobile.html` (inert + aria-hidden wired in script,
not in comments).

## Completion criteria

- [ ] `revisit-modal-states.html` modal shells carry `role="dialog"
      aria-modal="true" aria-labelledby` (≥ 9 occurrences)
- [ ] Rollback toast retains `role="status" aria-live="polite"`
- [ ] `feedback-inline-mobile.html` has a `<script>` block implementing
      `openSheet()` / `closeSheet()` that wire inert + aria-hidden
- [ ] FAB + close-button `onclick=` attributes call the script functions
      (no `/* dev stage: ... */` narration left)
- [ ] Sheet root carries `data-focus-trap` marker attribute
- [ ] `aria-landmark-spec.md §3.7` documents the dialog-open/close lifecycle
      with before/after code and NVDA/JAWS rationale
- [ ] feedback-assessor verifies FB-74 and FB-80 against their concrete claims
