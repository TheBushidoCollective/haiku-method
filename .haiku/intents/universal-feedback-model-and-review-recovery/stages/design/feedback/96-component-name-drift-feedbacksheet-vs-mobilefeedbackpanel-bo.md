---
title: >-
  Component-name drift: `FeedbackSheet` vs `MobileFeedbackPanel` both live;
  `Mobile` prefix supposedly retired
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T09:27:48Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

DESIGN-BRIEF §2 "Retired Components" table explicitly retires the `Mobile` prefix:

> `MobileFeedbackSheet` (standalone sheet wrapper) | `FeedbackSheet` (superseded by the unified `MobileFeedbackPanel` inside the bottom sheet) | The sheet only ever renders on mobile breakpoints, so the `Mobile` prefix was redundant; responsive behavior is baked into a single component. Matches the review-app convention (e.g. `ReviewSidebar`, not `DesktopReviewSidebar`).

But the replacement row itself uses `MobileFeedbackPanel` — contradicting its own retirement rationale (the `Mobile` prefix is redundant). Then §9 File Inventory lists `FeedbackSheet.tsx` as the New file, while state-coverage-grid.md §0 checklist + §7.8 call the component `FeedbackSheet (aka MobileFeedbackPanel)`. `unit-19-component-a11y-fixes.md` and `unit-22-review-notes.md:163` use `MobileFeedbackPanel` as the primary name.

Drift inventory:

- `DESIGN-BRIEF.md:119` — lists `FeedbackSheet (aka MobileFeedbackPanel)` (dual name).
- `DESIGN-BRIEF.md:597` — Retired Components row names BOTH in the same sentence.
- `DESIGN-BRIEF.md:810` — accessibility section uses `MobileFeedbackPanel` as the canonical name ("rendered by `FeedbackSheet`, opened by `FeedbackFloatingButton`").
- `state-coverage-grid.md:22` + §7.8 — `FeedbackSheet (aka MobileFeedbackPanel)`.
- `unit-19-component-a11y-fixes.md:62,139,163` — `MobileFeedbackPanel` as primary.
- DESIGN-BRIEF §9 File Inventory line 917 — `FeedbackSheet.tsx` is the only file listed; there is no `MobileFeedbackPanel.tsx`.

Either name survives review, but ONE must be authoritative. Having two live names — one retained in §9 File Inventory and one used throughout accessibility + unit docs — guarantees dev-stage confusion and inconsistent React-component file naming.

Fix: pick one canonical name (per the retirement rationale, `FeedbackSheet` is correct — no `Mobile` prefix). Rewrite every `MobileFeedbackPanel` reference across DESIGN-BRIEF, state-coverage-grid.md, aria-landmark-spec.md, aria-live-sequencing-spec.md, unit-19 frontmatter/body, and unit-22-review-notes.md to `FeedbackSheet`. Delete the "(aka MobileFeedbackPanel)" parenthetical from the Retired Components table — the retired name is `MobileFeedbackSheet`, not `MobileFeedbackPanel`, and the `aka` parenthetical re-seeds drift.

Post-fix gate: `grep -rn 'MobileFeedbackPanel' stages/design/ knowledge/` returns 0; `FeedbackSheet` is the only live name.
