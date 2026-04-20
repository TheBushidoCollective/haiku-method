---
title: >-
  feedback-inline-desktop.html cards lack role=list/listitem — mobile has it —
  1.3.1 inconsistency
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T17:53:13Z'
iteration: 5
visit: 5
source_ref: null
closed_by: unit-31-feedback-list-semantics-parity
bolt: 0
upstream_stage: null
---

The desktop review surface (`feedback-inline-desktop.html`) and its mobile counterpart (`feedback-inline-mobile.html`) render the same logical feedback list but expose it to AT very differently. Mobile correctly wraps the scrollable list in `role="list"` with each card as `role="listitem"` (feedback-inline-mobile.html:274 + 283, 296, 309, 335, 349). Desktop does not — the feedback cards live inside a plain `<div>` sidebar container with no list semantics, so AT users cannot discover "5 items in a list" or use list-navigation commands (VoiceOver "next list item", NVDA `I` / `K`).

**Why this matters (WCAG 1.3.1 Info and Relationships):**

- The visual cue — a vertical stack of cards with consistent spacing — communicates list structure to sighted users. The same structural information must be programmatically determinable for AT.
- A reviewer using a screen reader on desktop should get the same list-count announcement and list-navigation affordances as on mobile. The disparity means keyboard-only users on desktop have to Tab through every card plus every other interactive element in the sidebar, while mobile users can jump card-to-card.

**Compounds with existing focus-order spec:**

- `focus-order-spec.md §1 row N−6 through N` enumerates the sidebar cards as rows `N−6, N−5, …` but does NOT require that the card stack be wrapped in `role="list"`. The mobile `§2` treats the card list as a single flat Tab stop inside the sheet; the desktop doesn't mention list semantics at all.
- `aria-landmark-spec.md §2 Per-surface landmark map` lists `feedback-inline-desktop.html` as `<aside role="complementary" aria-label="Review sidebar">` but doesn't require list-structure inside.

**Fix required:**

1. Wrap the scrollable feedback-card container in `<div role="list" aria-label="Feedback items">` OR (preferable) change the container to a native `<ul>` with each card as `<li>` — native semantics are more robust across AT than `role="list"`/`role="listitem"`.
2. Add `role="listitem"` to each feedback card root (or wrap each card in `<li>`). The current focus-visible + tabindex="0" on the card root stays; adding `role="listitem"` does not change focusability.
3. Apply the same treatment to `feedback-card-states.html` (gallery artifact — the six state-variant cards should be `role="list"` / `role="listitem"` so the spec gallery matches what it documents).
4. Update `focus-order-spec.md §1` note row at N-6 to reference the list-structure requirement explicitly.
5. Update `aria-landmark-spec.md §2` with a "list semantics inside aside" row per artifact.
6. Add a verification grep to the feedback-assessor gate: `grep -c 'role="list"\|<ul' feedback-inline-desktop.html` ≥ 1.

**WCAG refs:** 1.3.1 Info and Relationships (AA) — structural relationships must be programmatically determinable.
