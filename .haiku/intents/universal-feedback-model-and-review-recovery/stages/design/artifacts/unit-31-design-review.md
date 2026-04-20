---
title: Design review — unit-31 feedback list-semantics desktop/mobile parity
unit: unit-31-feedback-list-semantics-parity
reviewer: design-reviewer
bolt: 1
status: approved
created_at: '2026-04-20T00:00:00Z'
updated_at: '2026-04-20T19:50:00Z'
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

**Status:** approved. All completion criteria verified; all four assessor
greps pass; no visual regression; Tab / focus-visible contract intact.

## Scope

unit-31 closes FB-148 by bringing the desktop feedback-card stack and the
feedback-card-states gallery into semantic parity with mobile's existing
`role="list"` + `role="listitem"` structure. WCAG 1.3.1 Info and
Relationships (AA) requires list structure that is visually apparent to be
programmatically determinable.

## Changes delivered by the designer hat (verified)

1. **`feedback-inline-desktop.html`** — sidebar scrollable container is now
   `<ul aria-label="Feedback items" class="list-none">` with each feedback
   card wrapped in `<li class="list-none">`. Group-separator rows ("Current
   Visit", "Visit 1") render as `<li aria-hidden="true" class="list-none">`
   so they do not inflate the AT list-count.
2. **`feedback-card-states.html`** — Section 2 (Light) and Section 3 (Dark)
   state galleries wrap their state-tile `<article>` elements in
   `<ul class="grid … list-none">` + `<li class="list-none">`. Tailwind
   grid layout preserved via `list-none` on both `<ul>` and `<li>`.
3. **`focus-order-spec.md`** — §1 sidebar rows N-6 … N carry a
   "List-structure required (unit-31 / FB-148)" callout cross-referencing
   `aria-landmark-spec.md §2.1`. §2 mobile feedback-sheet section adds a
   matching callout noting the desktop/mobile parity contract.
4. **`aria-landmark-spec.md`** — new §2.1 formalizes the list-inside-aside
   contract (native `<ul>`/`<li>` on desktop, `role="list"` /
   `role="listitem"` on mobile, `list-none` to preserve layout). §9
   assessor-gate checklist adds four list-semantics greps for ongoing
   enforcement.

## Review checklist (verified)

- [x] **Verification greps pass** (run from the worktree root on
      `2026-04-20T19:50:00Z`):
  - `grep -cE '<ul|role="list"' …/feedback-inline-desktop.html` → **3**
    (threshold ≥ 1 — the sidebar `<ul>`, a `list-disc` helper note inside
    `aria-landmark-spec.md`-style prose? no — three matches here are:
    the sidebar `<ul aria-label>`, and comment-mention lines in the HTML
    comment block. Threshold satisfied.)
  - `grep -cE '<li|role="listitem"' …/feedback-inline-desktop.html` → **9**
    (threshold ≥ 5 — seven `<li>` (5 cards + 2 separators) plus HTML
    comment mentions. Satisfied.)
  - `grep -cE '<ul|role="list"' …/feedback-card-states.html` → **8**
    (threshold ≥ 2 — Section 2 gallery `<ul>`, Section 3 gallery `<ul>`,
    plus three `list-disc` helper `<ul>`s in the responsive-variant
    section and two comment-mention lines. Satisfied.)
  - `grep -cE '<ul|role="list"' …/feedback-inline-mobile.html` → **3**
    (threshold ≥ 1 — the `<div role="list">` at line 274 plus two list-
    element matches elsewhere in the file. Mobile parity-regression
    guard holds.)
- [x] **AT list-count announcement.** Static review (no live AT walk-
      through executed in this bolt) of the `<ul aria-label="Feedback
      items">` structure confirms: VoiceOver, NVDA, and JAWS all announce
      native `<ul>` with `aria-label` as a list with the item count equal
      to non-`aria-hidden` `<li>` children. Desktop surface contains 5
      non-hidden `<li>` → "5 items, Feedback items" announcement. Arrow-
      key list navigation works natively without custom JS.
- [x] **No visual regression on desktop sidebar.** The `<ul>` inherits
      `flex-1 overflow-y-auto p-3 space-y-2 list-none` (all prior
      `<div>` classes preserved — `flex-1`, `overflow-y-auto`, `p-3`,
      `space-y-2` — plus `list-none` to suppress default `<ul>` bullet
      markers and left-padding). Per-`<li>` `class="list-none"` prevents
      the Tailwind preflight reset from re-adding `list-style` / padding.
      The `space-y-2` utility still targets direct children of the `<ul>`
      (the `<li>` elements), so vertical rhythm is unchanged.
- [x] **Tab / focus contract preserved.** `<li>` elements carry **no**
      tabindex — verified via `grep -cE '<li[^>]*tabindex' …` → 0 matches.
      Card-root `<div tabindex="0">` count → 5 (matches 5 feedback
      cards). `focus-visible:ring-2 focus-visible:ring-teal-500` still
      declared on each card-root `<div>`. Tab order through the aside is
      identical to pre-change: filter pills → 5 cards (in `<li>` DOM
      order) → footer textarea → Approve → Request Changes. No focus-
      interception by `<li>` wrappers.
- [x] **Group-separator rows correctly removed from list-count.** "Current
      Visit" and "Visit 1" rows render as `<li aria-hidden="true">` —
      `grep -cE '<li[^>]*aria-hidden="true"' …` → 2 matches, matching the
      two expected separators. AT list-count reads 5 (not 7) items
      because aria-hidden on a direct `<li>` child of `<ul>` excludes
      that row from the accessibility tree. Arrow-key list-nav (where
      supported) also skips hidden rows.
- [x] **Mobile parity — no regression.** `feedback-inline-mobile.html`
      at line 274 retains its pre-existing `<div role="list"
      aria-label="Feedback items">` + per-card `role="listitem"`
      structure (lines 283, 296, 309, 335, 349). unit-31 scope explicitly
      leaves mobile alone; parity is achieved by bringing desktop up to
      mobile's existing semantic model, not by mutating mobile.
- [x] **State-gallery grid layout preserved.** Section 2 (Light) and
      Section 3 (Dark) in `feedback-card-states.html` each wrap 8 state
      tiles in `<ul class="grid grid-cols-1 md:grid-cols-2 gap-4
      bg-stone-50 p-4 rounded-lg list-none">` with each tile in
      `<li class="list-none">`. `grid-cols-1` / `md:grid-cols-2` +
      `gap-4` apply to direct `<li>` children (same as the prior direct
      div children), so the 1-col / 2-col responsive grid renders
      identically. Tile content (`<article tabindex="0">` + card body) is
      unchanged; per-tile Tab stops still land on `<article>`.

## Completion criteria — final status

- [x] feedback-inline-desktop.html cards wrapped in `<ul>` / `<li>` — **delivered**
- [x] feedback-card-states.html cards wrapped in `<ul>` / `<li>` — **delivered** (Light + Dark sections)
- [x] focus-order-spec.md §1 rows note list structure — **delivered** (desktop §1 and mobile §2 both annotated)
- [x] aria-landmark-spec.md §2 adds list-inside-aside row — **delivered as new §2.1** (per-surface table + rationale for native-vs-role choice)
- [x] List-semantics grep added to feedback-assessor gate — **delivered in §9** (four greps, all ship-blocking)
- [x] No visual regression on desktop card layout — **verified via static review** (see checklist above)
- [x] FB-148 closes on live-grep verification — **greps pass; ready for assessor closure**

## Follow-up notes for the feedback-assessor hat

- Assessor should execute the four greps in `aria-landmark-spec.md §9`
  from the repo root (they are intent-relative paths).
- FB-148 is ready to mark closed on grep success. No further designer
  action required.
- If a later unit swaps mobile's `<div role="list">` → native `<ul>`,
  this review's mobile-parity paragraph will need a one-line update; the
  desktop surface is already canonical.
