---
title: Design review — unit-31 feedback list-semantics desktop/mobile parity
unit: unit-31-feedback-list-semantics-parity
reviewer: design-reviewer
bolt: 1
status: pending
created_at: '2026-04-20T00:00:00Z'
updated_at: '2026-04-20T00:00:00Z'
artifacts_reviewed:
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/focus-order-spec.md
  - stages/design/artifacts/aria-landmark-spec.md
closes_fb:
  - FB-148
---

# Design review — unit-31 feedback list-semantics parity

**Status:** pending (design-reviewer hat to populate).

## Scope

unit-31 closes FB-148 by bringing the desktop feedback-card stack and the
feedback-card-states gallery into semantic parity with mobile's existing
`role="list"` + `role="listitem"` structure. WCAG 1.3.1 Info and
Relationships (AA) requires list structure that is visually apparent to be
programmatically determinable.

## Changes delivered by the designer hat

1. **`feedback-inline-desktop.html`** — sidebar scrollable container is now
   `<ul aria-label="Feedback items" class="list-none">` with each feedback
   card wrapped in `<li class="list-none">`. Group-separator rows ("Current
   Visit", "Visit 1") render as `<li aria-hidden="true">` so they do not
   inflate the AT list-count.
2. **`feedback-card-states.html`** — Section 2 (Light) and Section 3 (Dark)
   state galleries wrap their tiles in `<ul class="grid … list-none">` +
   `<li class="list-none">`. Layout preserved via `list-none` + matching
   `class` on each `<li>`.
3. **`focus-order-spec.md` §1** — sidebar-card rows (desktop) and mobile
   sheet body both carry explicit "list-structure required" notes with
   cross-refs to `aria-landmark-spec.md §2.1`.
4. **`aria-landmark-spec.md`** — new §2.1 formalizes the list-inside-aside
   contract (native `<ul>`/`<li>` on desktop, `role="list"`/
   `role="listitem"` on mobile, `list-none` to preserve layout). §9
   assessor-gate checklist gains four list-semantics greps for ongoing
   enforcement.

## Review checklist (for design-reviewer hat)

- [ ] Run verification greps (see `aria-landmark-spec.md §9` list-semantics
      block) — all four must pass.
- [ ] Walk `feedback-inline-desktop.html` with VoiceOver (or NVDA / JAWS /
      Orca AT-simulation). Confirm the screen reader announces the card
      count (e.g., "5 items in a list") and supports arrow-key list
      navigation card-to-card.
- [ ] Confirm no visual regression on the desktop sidebar card layout —
      `<ul>` + `<li>` with `list-none` preserves the flex / space-y
      rendering.
- [ ] Confirm `tabindex="0"` + `focus-visible` still work on the card-root
      `<div>` (the `<li>` wrapper does not intercept focus).
- [ ] Confirm parity with mobile's pre-existing `role="list"` +
      `role="listitem"` structure in `feedback-inline-mobile.html` — no
      regression there.
- [ ] Confirm the state-gallery wrappers in `feedback-card-states.html`
      preserve the Tailwind grid layout in both Light and Dark sections.

## Completion criteria

- [ ] feedback-inline-desktop.html cards wrapped in `<ul>` / `<li>` — delivered
- [ ] feedback-card-states.html cards wrapped in `<ul>` / `<li>` — delivered
- [ ] focus-order-spec.md §1 rows note list structure — delivered
- [ ] aria-landmark-spec.md §2 adds list-inside-aside row — delivered as §2.1
- [ ] List-semantics grep added to feedback-assessor gate — delivered in §9
- [ ] No visual regression on desktop card layout — **design-reviewer verifies**
- [ ] FB-148 closes on live-grep verification — **design-reviewer verifies**
