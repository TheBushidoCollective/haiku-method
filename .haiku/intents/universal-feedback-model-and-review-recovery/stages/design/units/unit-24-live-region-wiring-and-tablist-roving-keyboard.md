---
title: >-
  Live-region wiring in feedback-card-states + tablist roving-tabindex keyboard
  contract for feedback-inline desktop/mobile
type: design
closes:
  - FB-83
  - FB-84
depends_on: []
inputs:
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/aria-live-sequencing-spec.md
  - stages/design/artifacts/aria-landmark-spec.md
  - stages/design/artifacts/focus-order-spec.md
outputs:
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/focus-order-spec.md
quality_gates:
  - >-
    `feedback-card-states.html` contains the canonical two-region live-region
    block at the bottom of `<body>`:
    `<div id="feedback-live-polite" role="status" aria-live="polite"
    aria-atomic="true" class="sr-only"></div>` and
    `<div id="feedback-live-assertive" role="alert" aria-live="assertive"
    aria-atomic="true" class="sr-only"></div>`, matching the contract in
    `aria-landmark-spec.md §1` and already present in
    `feedback-inline-desktop.html:514-515` and `feedback-inline-mobile.html`.
    `grep -cE 'id="feedback-live-polite"|id="feedback-live-assertive"'
    stages/design/artifacts/feedback-card-states.html` returns 2.
  - >-
    Each interactive button in `feedback-card-states.html` (Close, Reject,
    Approve, Re-open on every card variant) carries an inline `<script>` hook
    (or calls a page-level function) that writes the three-phase sequence
    from `aria-live-sequencing-spec.md §2` into the appropriate region: a
    pending-phase `"FB-XX marking as closed…"` into
    `#feedback-live-polite`, a success-phase `"FB-XX closed."` into the same,
    and any rollback error into `#feedback-live-assertive`. Minimum demo-level
    wiring: `el.textContent = '…'` mutations on the live region. The script
    MUST actually execute in the wireframe (not be left as a comment), so
    manual testing of the artifact reads announcements aloud via any
    screen reader.
  - >-
    `feedback-card-states.html` head-of-document comment block points at
    `aria-live-sequencing-spec.md` as the canonical contract for the
    announcement sequence, and names
    `aria-landmark-spec.md §1 "Two live regions, not one"` as the rule
    that polite and assertive regions are non-interchangeable. This makes
    the spec discoverable alongside the visual reference for anyone opening
    the states file first.
  - >-
    `feedback-inline-desktop.html` and `feedback-inline-mobile.html` each
    carry a `<script>` block implementing the WAI-ARIA APG tablist
    roving-tabindex keyboard contract for the tab strip at L109-112 /
    L68-71 respectively. Events wired: Arrow Right (or Down) → focus next,
    skip disabled, wrap to first; Arrow Left (or Up) → focus previous, wrap
    to last; Home → first tab; End → last tab; Enter / Space on focused tab
    → set `aria-selected="true"` and reveal matching `<tabpanel>`. The
    script updates `tabindex` to `0` on the newly-focused tab and `-1` on
    all others so Tab key leaves the tablist after the active tab (does not
    iterate through inactive tabs). `grep -cE 'addEventListener\(.keydown'
    stages/design/artifacts/feedback-inline-desktop.html
    stages/design/artifacts/feedback-inline-mobile.html` returns ≥ 2.
  - >-
    `focus-order-spec.md §10 "Test checklist"` carries three new bullet
    items: (a) "Inside the tablist, pressing Arrow Right moves focus and
    updates `aria-selected`"; (b) "Home/End keys land on first/last tab";
    (c) "Tab key leaves the tablist after the active tab (does NOT iterate
    through inactive tabs)". A spec-level note is added clarifying that
    `tabindex="-1"` WITHOUT an arrow-key handler is a violation, not a
    safe default — this prevents future designers from repeating the
    static-tabindex-only pattern.
---
# Live-region wiring + tablist roving-tabindex keyboard contract

## Scope

Two findings where a spec defines a contract but the wireframe artifacts
don't model it — dev stage inherits a silently-broken UI:

- **FB-83**: `aria-live-sequencing-spec.md` defines a three-phase
  announcement template, and `aria-landmark-spec.md §1` mandates two
  live-region elements (`#feedback-live-polite` + `#feedback-live-
  assertive`). `feedback-inline-desktop.html` and
  `feedback-inline-mobile.html` wire both correctly, but
  `feedback-card-states.html` — the canonical state reference that
  dev will wire React against — has neither the regions nor the
  announcement sequencing. Optimistic-UI transitions (pending → closed,
  pending → rejected, etc.) will ship silent for screen-reader users.
  WCAG 4.1.3 Status Messages fails at dev hand-off.
- **FB-84**: `focus-order-spec.md §2` declares the standard ARIA
  tablist roving-tabindex pattern for the feedback-inline tab strip,
  but the artifacts implement only the static `tabindex` values — no
  Arrow-key handler. Inactive tabs are completely unreachable by
  keyboard (WCAG 2.1.1 Keyboard), and the tab strip is the primary
  filter UI in the feedback panel. Unwrapped, dev inherits the broken
  pattern.

## Approach

Designer hat:

1. **FB-83 primary fix**: add the canonical two-region live-region block
   to the bottom of `<body>` in `feedback-card-states.html`. Verify
   markup matches `aria-landmark-spec.md §1` exactly (same ids, same
   roles, same `aria-atomic="true"`, same `sr-only` class).
2. **FB-83 demo wiring**: add a small `<script>` block at the bottom of
   the same file that binds a click handler to each card's action
   button (Close, Reject, Approve, Re-open). On click, write the
   three-phase sequence from `aria-live-sequencing-spec.md §2` into
   the appropriate region. Minimum demo-level fidelity — `el.textContent
   = '…'` is fine for the wireframe. The point is the dev stage
   inherits the contract.
3. **FB-83 cross-link**: add a head-of-document HTML comment in
   `feedback-card-states.html` pointing at both
   `aria-live-sequencing-spec.md` and
   `aria-landmark-spec.md §1 "Two live regions, not one"`.
4. **FB-84 primary fix**: add a `<script>` block at the bottom of
   both `feedback-inline-desktop.html` and `feedback-inline-mobile.html`
   implementing the WAI-ARIA APG tablist roving-tabindex contract.
   Events: Arrow {Right/Down} → next, Arrow {Left/Up} → prev, Home →
   first, End → last, Enter/Space → activate + update `aria-selected`.
   Update `tabindex` on each focus change so Tab leaves the tablist
   after the active tab.
5. **FB-84 spec update**: amend `focus-order-spec.md §10` "Test
   checklist" with the three new items, and add a spec-level note that
   `tabindex="-1"` without an arrow-key handler is a violation.

Design-reviewer hat runs each grep command, confirms counts, and walks
the feedback-card-states demo in a browser to confirm the live-region
announcements fire (or in a screen-reader simulator) — a visible
console log is acceptable if screen-reader testing is not scripted.

Feedback-assessor hat verifies FB-83 against the live-region markup
count in `feedback-card-states.html` and FB-84 against the
Arrow-key handler count in both feedback-inline files.

## Completion criteria

- [ ] `feedback-card-states.html` has the two canonical live-region
      elements at the bottom of `<body>`
- [ ] Each card action button wires a demo-level three-phase
      announcement to the appropriate region
- [ ] Head-of-document comment points at the two spec files
- [ ] `feedback-inline-desktop.html` has a keyboard roving-tabindex
      script block for the tablist
- [ ] `feedback-inline-mobile.html` has the same, matching the desktop
      contract
- [ ] `focus-order-spec.md §10` carries the three new test items
- [ ] `focus-order-spec.md` carries the `tabindex=-1 without arrow-key
      handler = violation` note
- [ ] feedback-assessor verifies FB-83 and FB-84 against their concrete claims
