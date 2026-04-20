---
title: >-
  Produce feedback-summary-bar.html — the missing state-coverage artifact for
  FeedbackSummaryBar. DESIGN-BRIEF §2 and state-coverage-grid §7.6 name the
  component and declare its 6-state grid, but no rendered artifact exists.
  Dev stage has nothing to verify against at design-review time
type: design
closes:
  - FB-149
depends_on: []
inputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/feedback-inline-desktop.html
outputs:
  - stages/design/artifacts/feedback-summary-bar.html
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/unit-33-design-review.md
quality_gates:
  - >-
    New file `stages/design/artifacts/feedback-summary-bar.html` exists
    and renders the `FeedbackSummaryBar` component across the 6 canonical
    states per DESIGN-BRIEF §2 state-coverage requirement: default / hover
    / focus / active / disabled / error. Layout is a 3-row × 6-col (or
    equivalent) matrix:
    - Row 1: populated states — pending / addressed / closed counts
      rendered with the status-badge tokens from feedback-card-states.html.
    - Row 2: interactive states — hover (cursor over summary chip) / focus
      (keyboard focus-visible ring) / active (mousedown).
    - Row 3: degraded states — disabled (no feedback data) / error (API
      fail → bar hidden per §7.6 rationale with a fallback message).
    File size kept small (~3 KB target).
  - >-
    File follows the artifact conventions of sibling state-coverage
    artifacts (`feedback-card-states.html`, `agent-feedback-toggle-spec.
    html`): page-wrapper uses `max-w-page`; palette uses `stone-*` (not
    `gray-*`); radii from DESIGN-TOKENS §1.5; typography floor observed
    (`text-[11px]` pairs with `font-semibold`, else `text-xs`); `prefers-
    reduced-motion` guard block present if any transitions declared;
    focus-visible ring on interactive states. All stage quality gates
    pass when scanned.
  - >-
    `state-coverage-grid.md §0 "DESIGN-BRIEF §2 component checklist"` —
    row for `FeedbackSummaryBar` updated to point at
    `feedback-summary-bar.html` as the rendered artifact (previously
    pointed only at `review-package-structure.html`, which enumerates the
    component but doesn't visualize it). Row count remains consistent
    with unit-32's 15-row count.
  - >-
    `state-coverage-grid.md §7.6` (FeedbackSummaryBar row) updated with
    an artifact pointer so the state-grid row cross-references the
    visual.
  - >-
    Cross-reference gate: `ls stages/design/artifacts/feedback-summary-
    bar.html` returns the file; `grep -c 'FeedbackSummaryBar'
    stages/design/artifacts/feedback-summary-bar.html` ≥ 1 (component
    name referenced in the file).
---
# FeedbackSummaryBar state-coverage artifact

## Scope

**FB-149** — DESIGN-BRIEF §2 state-coverage requirement: "Every new
component in this intent ... MUST ship with a six-state grid (default /
hover / focus / active / disabled / error) **rendered alongside its
component spec**." DESIGN-BRIEF §2 "FeedbackSummaryBar" block (L319-336)
gives a textual spec but no visual rendering.

Every sibling §2 component has a rendered artifact:
- `FeedbackStatusBadge` → feedback-card-states.html (4 status swatches).
- `FeedbackOriginIcon` → feedback-inline-desktop.html / mobile (6 swatches).
- `FeedbackItem` → feedback-card-states.html (compact + expanded).
- `FeedbackList` → feedback-inline-desktop.html + comments-list-with-
  agent-toggle.html.
- `AgentFeedbackToggle` → agent-feedback-toggle-spec.html.
- `FeedbackSheet` → feedback-inline-mobile.html.
- `FeedbackFloatingButton` → feedback-inline-mobile.html.
- `AssessorSummaryCard` → assessor-summary-card.html.
- `StageProgressStrip` → stage-progress-strip.html.
- `RevisitModal` → revisit-modal-spec.html + revisit-modal-states.html.

`FeedbackSummaryBar` is the only §2 component without a rendered artifact.
The state-coverage-grid §7.6 row is verifiable only in prose — dev stage
cannot compare its implementation against a visual reference.

## Approach

**Designer hat:**

1. Author `stages/design/artifacts/feedback-summary-bar.html` following the
   artifact conventions used by `feedback-card-states.html` and
   `agent-feedback-toggle-spec.html`:
   - HTML5 `<!DOCTYPE>` with Tailwind via CDN or stage-standard link.
   - `<head>` includes `prefers-reduced-motion` guard block (unit-30's
     canonical).
   - `<body>` wraps content in `max-w-page mx-auto px-4 py-8`.
   - 3-row × 6-col matrix rendering each state:
     - Row 1 (populated counts): pending (amber badge "3 pending") /
       addressed (stone "2 addressed") / closed (teal "5 closed"). Three
       canonical count combinations (all-pending / mixed / all-closed).
     - Row 2 (interactive): hover (mouseover highlight) / focus (teal
       focus-visible ring) / active (pressed state).
     - Row 3 (degraded): disabled (no data — ghost placeholder at
       muted-surface tokens, NOT opacity) / error (API fail → bar hidden
       per §7.6 rationale, replaced with the small fallback message
       "Summary unavailable — refresh to retry").
2. Each row labeled with `<h2 class="text-sm font-semibold text-stone-700
   dark:text-stone-300 mb-2">` so the spec is self-documenting.
3. No `opacity-*` patterns on text-carrying surfaces. No raw-px sizing
   magic numbers — reference DESIGN-TOKENS §1.6 (unit-27) or use Tailwind
   scale. No `gray-*` palette. No bare `rounded`. Typography floor
   observed. This file is born compliant with every unit-26 / unit-27 /
   unit-28 gate.
4. `state-coverage-grid.md §0 checklist` and `§7.6` rows updated to cite
   `feedback-summary-bar.html` as the rendered artifact.

**Design-reviewer hat:**

- Run every stage quality gate (opacity / palette / radii / magic-number
  sizing / typography floor / reduced-motion guard) against the new file.
  Each must pass.
- Walk the 6 states visually — each must be distinguishable and match the
  component-inventory row for FeedbackSummaryBar.
- Confirm `state-coverage-grid.md §0` row count unchanged (15) and §7.6
  row cites the artifact.

**Feedback-assessor hat:**

- Confirm file exists via `ls`.
- Confirm all stage gates pass on the new file.
- FB-149 closes on file-exists + gate-pass verification.

## Completion criteria

- [ ] feedback-summary-bar.html authored
- [ ] 6 states rendered across a 3-row × 6-col matrix
- [ ] File passes all stage quality gates (opacity / palette / radii /
      sizing / typography / reduced-motion)
- [ ] state-coverage-grid §0 + §7.6 cite the artifact
- [ ] FB-149 closes on file-exists + gate-pass verification
