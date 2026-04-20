---
title: >-
  DESIGN-BRIEF §2 retired-row (L597) contradicts §9 and §2.L119 on FeedbackSheet
  vs MobileFeedbackPanel canonical name
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T17:53:09Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

DESIGN-BRIEF §2 ships three mutually contradictory statements about the mobile bottom-sheet component's canonical name:

1. **L119 (FB-56 extension)**: lists the component as `FeedbackSheet` (aka `MobileFeedbackPanel`)". "aka" implies the two names are equivalent aliases, but the component-inventory convention (§"Pattern Language (Non-Negotiable)" in `component-inventory.md`) says canonical = one PascalCase name, no multi-name aliasing.

2. **L597 (Retired Components row)**: `MobileFeedbackSheet (standalone sheet wrapper) | FeedbackSheet (superseded by the unified MobileFeedbackPanel inside the bottom sheet) | …`. The "Replaced by" column says `FeedbackSheet`, but the rationale text says `FeedbackSheet` was "superseded by MobileFeedbackPanel" — so is `MobileFeedbackPanel` the current name or the retired name? The row is internally inconsistent.

3. **L917 (§9 File Inventory)**: `review-app/src/components/FeedbackSheet.tsx | New | Full-screen sheet overlay (mobile-only render; responsive behavior baked in — no Mobile prefix needed)`. This row unambiguously pins the canonical file name as `FeedbackSheet.tsx`, which implies `MobileFeedbackPanel` is NOT the live name.

Downstream effect:
- Unit-19 and unit-20 both use `MobileFeedbackPanel` in prose (see `units/unit-19-component-a11y-fixes.md:39,62,139,163,200` and `units/unit-20-source-doc-opacity-and-grid-consistency.md:44,53,92,121,154,226`) — the units encode the ambiguity downstream.
- `aria-landmark-spec.md §5` (referenced by DESIGN-BRIEF L810) allegedly documents the `MobileFeedbackPanel dialog lifecycle`.
- Dev stage will ship whichever name they see first — the component-inventory consistency goal of "one canonical PascalCase name per component" is defeated.

Fix — pick ONE canonical name and eliminate the other everywhere:

**Recommended: canonical = `FeedbackSheet`** (matches §9 file inventory, matches the "Mobile prefix redundant" rationale in §2 L597 and `component-inventory.md`, and is the shorter name):

1. L119: drop `(aka MobileFeedbackPanel)` → just `FeedbackSheet`.
2. L597 Retired row "Replaced by" + rationale: the rationale's "superseded by MobileFeedbackPanel" is wrong; rewrite to "The sheet only ever renders on mobile breakpoints, so the `Mobile` prefix was redundant. Canonical name: `FeedbackSheet`. Responsive behavior is baked in." — remove any mention of `MobileFeedbackPanel`.
3. L810 accessibility prose: rewrite `The MobileFeedbackPanel (rendered by FeedbackSheet, …)` → `The FeedbackSheet (opened by FeedbackFloatingButton, …)` — one component, one name.
4. `state-coverage-grid.md §0` L22: `FeedbackSheet (aka MobileFeedbackPanel) | §3 FAB + bottom sheet + §7` → `FeedbackSheet | §3 FAB + bottom sheet + §7.8`.
5. Stage-wide sweep: `grep -rEn 'MobileFeedbackPanel' stages/design/` should return 0 after the fix. Unit-19 / unit-20 prose rewrites are upstream-finding territory — those units have already executed — so add a design-reviewer gate that fails if `MobileFeedbackPanel` appears anywhere in `stages/design/artifacts/` or `stages/design/DESIGN-BRIEF.md`, and leave a downstream pointer in unit-19/20 prose.

Post-fix gate (add to design-reviewer):
`grep -rEn 'MobileFeedbackPanel' stages/design/artifacts/ stages/design/DESIGN-BRIEF.md` → 0 matches.
