---
title: >-
  State coverage grid misses required six-state columns for multiple components
  mandated by DESIGN-BRIEF §2
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T02:57:06Z'
iteration: 3
visit: 3
source_ref: null
closed_by: unit-20-source-doc-opacity-and-grid-consistency
---

`DESIGN-BRIEF.md §2 Component Inventory` (lines 115-117) makes state coverage non-negotiable for every new component in this intent:

> "Every new component in this intent — and every new component introduced in downstream stages — MUST ship with a six-state grid (default / hover / focus / active / disabled / error) rendered alongside its component spec."

And declares `stages/design/artifacts/state-coverage-grid.md` the template that every FB-25-addressed component must appear in.

Surveying `artifacts/state-coverage-grid.md` against the component inventory in DESIGN-BRIEF §2 / `component-inventory.md` reveals missing or incomplete coverage for required components:

**Missing entirely from the grid (but required by DESIGN-BRIEF §2):**
- `FeedbackStatusBadge` — the grid has one row ("Status badge (pending / addressed / closed / rejected)") that marks hover/focus/active/disabled as `— [2]` with the footnote "Status badge is a label, not a control". That's acceptable for *that* analysis, but it's tucked under "Feedback cards (sidebar list items)" and treats the badge as one row instead of the four-status × two-theme matrix the brief requires. There's no `disabled` and no `error`-state badge rendering described.
- `FeedbackOriginIcon` — not in the grid at all. Six origins × two themes should at minimum have default/focus rows plus an N/A rationale for hover/active/disabled.
- `FeedbackList` — the grid covers `Feedback card (compact)` and `Feedback card (expanded)` but not the enclosing list container itself; the `empty` state described in DESIGN-BRIEF §3 ("No feedback yet…" vs "All feedback addressed!") is not enumerated with the required six-state + empty columns for the list container.
- `FeedbackSummaryBar` — entire component spec from DESIGN-BRIEF §2 "FeedbackSummaryBar" (lines 318-333) has no row. The brief says each count is a toggleable filter button ("Clickable counts filter the list to that status"), so default/hover/focus/active/disabled/error are all reachable for each count chip.
- `AgentFeedbackToggle` — entire component spec from DESIGN-BRIEF §2 "AgentFeedbackToggle" (lines 335-388) has no row. This is a `role="switch"` with on/off states plus focus/disabled/error — the brief explicitly calls out the switch ARIA contract (lines 380-385). Skipping it is a direct violation of the §2 mandate.
- `FeedbackSheet` and `FeedbackFloatingButton` — FAB has a row under "FAB + bottom sheet (mobile)" but the `FeedbackSheet` container itself has one row covering only its close button and sheet-enter anim; no grid coverage of the sheet-level `empty` state, `loading`, or `error` (e.g. fetch failure on open).

This is **FB-56 recurring at broader scope** (FB-56 closed only the SidebarSegmentedControl drop; it did not re-verify the entire §2 inventory).

**Recommended fix:** expand `state-coverage-grid.md` with a dedicated table per DESIGN-BRIEF §2 component (one section per: `FeedbackStatusBadge`, `FeedbackOriginIcon`, `FeedbackItem`, `FeedbackList`, `FeedbackSummaryBar`, `AgentFeedbackToggle`, `FeedbackSheet`, `FeedbackFloatingButton`, `FeedbackFloatingButton pulse`). Every cell either renders the state or uses `—` with a footnote giving the concrete rationale. The design-reviewer hat must walk the grid row-by-row before approval (per the brief's own rule) — that walk is currently impossible because ~half the required components have no rows.
