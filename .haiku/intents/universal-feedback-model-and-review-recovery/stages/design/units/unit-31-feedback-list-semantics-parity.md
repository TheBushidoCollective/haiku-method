---
title: >-
  feedback-inline-desktop.html and feedback-card-states.html — wrap feedback
  card stacks in native `<ul>` / `<li>` (or `role="list"` / `role="listitem"`)
  so desktop AT users get the same list-count announcement + list-navigation
  affordances as mobile. Focus-order + aria-landmark specs updated to require
  list semantics inside the review aside
type: design
closes:
  - FB-148
depends_on: []
inputs:
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/focus-order-spec.md
  - stages/design/artifacts/aria-landmark-spec.md
outputs:
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/focus-order-spec.md
  - stages/design/artifacts/aria-landmark-spec.md
  - stages/design/artifacts/unit-31-design-review.md
quality_gates:
  - name: desktop-feedback-list-ul-with-label
    command: >-
      grep -cE '<ul[^>]*aria-label="Feedback
      items"|role="list"[^>]*aria-label="Feedback items"'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-inline-desktop.html
  - name: desktop-feedback-cards-in-list-items
    command: >-
      python3 -c "import re, sys; c =
      open('.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-inline-desktop.html').read();
      m = re.search(r'<ul[^>]*aria-label=\"Feedback items\"[^>]*>(.*?)</ul>', c,
      re.S); sys.exit(0 if m and len(re.findall(r'<li\b', m.group(1))) >= 3 else
      1)"
  - name: feedback-card-states-uses-list-semantics
    command: >-
      grep -cE '<ul|role="list"'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-card-states.html
  - name: mobile-feedback-list-parity-preserved
    command: >-
      grep -cE '<ul|role="list"'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-inline-mobile.html
  - name: aria-landmark-spec-cites-list-inside-aside
    command: >-
      grep -iE 'role="list"|<ul|list semantics|listitem'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/aria-landmark-spec.md
status: completed
bolt: 1
hat: feedback-assessor
started_at: '2026-04-20T19:39:06Z'
hat_started_at: '2026-04-20T19:48:29Z'
iterations:
  - hat: designer
    started_at: '2026-04-20T19:39:06Z'
    completed_at: '2026-04-20T19:45:20Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T19:45:20Z'
    completed_at: '2026-04-20T19:48:29Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T19:48:29Z'
    completed_at: '2026-04-20T19:50:23Z'
    result: advance
completed_at: '2026-04-20T19:50:23Z'
---
# feedback list-semantics desktop/mobile parity

## Scope

**FB-148** — `feedback-inline-desktop.html` and
`feedback-inline-mobile.html` render the same logical feedback list but
expose it to assistive technology differently:

- Mobile (feedback-inline-mobile.html:274, 283, 296, 309, 335, 349): cards
  wrapped in `role="list"` with each `role="listitem"`. AT users get
  "5 items in a list" announcement and can jump card-to-card.
- Desktop (feedback-inline-desktop.html): cards live in a plain `<div>`
  sidebar. No list structure exposed. Keyboard-only desktop users have to
  Tab through every card plus every other interactive element in the
  aside.

WCAG 1.3.1 Info and Relationships (AA) — structural relationships must be
programmatically determinable. The visual "stack of consistent-spacing
cards" is list structure; it must be exposed to AT.

Compounds with `focus-order-spec.md §1` rows N-6 through N (enumerates
sidebar card Tab rows but doesn't require list structure) and `aria-
landmark-spec.md §2` (maps aside to `role="complementary"` but doesn't
require list inside).

## Approach

**Designer hat:**

1. `feedback-inline-desktop.html` — wrap the scrollable feedback-card
   container. Prefer native `<ul>` / `<li>`:
   - Change the scrollable `<div>` that contains the cards to a `<ul
     class="... list-none" aria-label="Feedback items">`.
   - Wrap each feedback card in `<li>` (keep existing card root
     `tabindex="0"` + focus-visible + aria-label).
   - Native `<ul>` / `<li>` are more robust across AT than `role="list"`
     / `role="listitem"` (no "list" role flattening — some AT skip
     role="list" with only 1 descendant).
2. `feedback-card-states.html` — apply the same wrapping to the state-
   gallery card collection. This is the canonical spec gallery for the
   `FeedbackItem` component; list semantics here must match the real
   render surface.
3. Update `focus-order-spec.md §1` rows N-6 through N with a trailing
   note: "sidebar-cards are rendered as `<li>` inside `<ul aria-
   label=\"Feedback items\">`; Tab stops per card + arrow-key
   list-navigation supported via the wrapping list semantics".
4. Update `aria-landmark-spec.md §2` with a new row:
   `<aside role="complementary"> → <ul role="list"> inside`.
5. Add the list-semantics grep to the feedback-assessor gate script
   inventory.

**Design-reviewer hat:**

- Run the verification greps.
- Walk the desktop artifact with VoiceOver (or verify via AT-simulation
  test): confirm "5 items in a list" announcement, arrow-key list-
  navigation, list-item counting work correctly.
- Confirm no visual regression — `<ul>` + `<li>` with `list-none`
  preserves the existing flex/grid layout.
- Confirm tabindex="0" + focus-visible still work on the card root
  (list-item wrapping doesn't intercept focus).

**Feedback-assessor hat:**

- Run the list-semantics grep.
- Confirm parity with mobile's existing list structure.
- FB-148 closes on live-grep + AT walkthrough verification.

## Completion criteria

- [x] feedback-inline-desktop.html cards wrapped in `<ul>` / `<li>`
- [x] feedback-card-states.html cards wrapped in `<ul>` / `<li>`
- [x] focus-order-spec.md §1 rows note list structure
- [x] aria-landmark-spec.md §2 adds list-inside-aside row
- [x] List-semantics grep added to feedback-assessor gate
- [x] No visual regression on desktop card layout
- [x] FB-148 closes on live-grep verification
