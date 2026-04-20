---
title: >-
  Source-doc consistency — DESIGN-BRIEF §7 CSS strip banned opacity/hex values,
  state-coverage-grid covers every DESIGN-BRIEF §2 component
type: design
closes:
  - FB-70
  - FB-75
depends_on: []
inputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/DESIGN-TOKENS.md
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/component-inventory.md
outputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/state-coverage-grid.md
quality_gates:
  - >-
    DESIGN-BRIEF.md §7 "CSS Additions" block no longer ships `opacity: 0.7` on
    `.feedback-item-closed` or `opacity: 0.5` on `.feedback-item-rejected` (the
    exact values §2 "Banned Text-on-Surface Pairs" forbids). Both selectors
    instead use the §2 remediation pattern: `.feedback-item-closed` gets
    `bg-green-50/60` + "Closed ·" prefix + ✓ glyph; `.feedback-item-rejected`
    gets `bg-stone-100` + "Rejected ·" prefix + full-opacity strikethrough via
    `.feedback-title { text-decoration: line-through }`. `grep -nE
    'opacity:\s*0\.[57]' stages/design/DESIGN-BRIEF.md` returns 0 hits.
  - >-
    DESIGN-BRIEF.md §7 CSS block contains zero raw hex color literals. The two
    previously-inline values (`#60a5fa`, `#4ade80`) are replaced with the
    canonical token references — `var(--color-blue-400)` /
    `var(--color-green-400)` or the Tailwind utility classes already defined in
    DESIGN-TOKENS.md §1.8. `grep -nE '#[0-9a-fA-F]{3,8}\b'
    stages/design/DESIGN-BRIEF.md` returns 0 hits inside the §7 code fences
    (inline prose hex references in §2 remediation examples remain as-is; they
    are descriptive, not code). unit-16's hex-count gate passes stage-wide after
    this change.
  - >-
    `stages/design/artifacts/state-coverage-grid.md` has a dedicated section
    (one table per component) for every component enumerated in DESIGN-BRIEF §2
    Component Inventory — at minimum: `FeedbackStatusBadge`,
    `FeedbackOriginIcon`, `FeedbackItem` (compact), `FeedbackItem` (expanded),
    `FeedbackList`, `FeedbackSummaryBar`, `AgentFeedbackToggle`,
    `FeedbackSheet`, `FeedbackFloatingButton`, `FeedbackFloatingButton.pulse`.
    Each row covers the canonical six states (default / hover / focus / active /
    disabled / error). Cells where a state is genuinely N/A carry `— (N/A:
    <rationale>)` text, not a bare em-dash. `FeedbackStatusBadge` expands to the
    four-status × two-theme matrix (pending / addressed / closed / rejected ×
    light / dark) rather than one "label not a control" row.
  - >-
    `FeedbackList` row in state-coverage-grid.md covers the list container's
    empty state ("No feedback yet…" vs "All feedback addressed!") and loading
    state, not just the enclosed cards. `FeedbackSheet` row covers sheet-level
    `empty`, `loading`, and `error` (e.g., fetch-failure on open) in addition to
    open/closed/anim states. `FeedbackSummaryBar` row treats each count chip as
    a toggleable filter button and enumerates default / hover / focus / active /
    disabled / error per chip. `AgentFeedbackToggle` row carries the switch ARIA
    contract (`role="switch" aria-checked="{on|off}"`) with on/off ×
    focus/disabled/error coverage.
  - >-
    DESIGN-BRIEF.md §2 explicitly cross-references the expanded state-coverage
    rows — either via an updated table-of-contents line at the top of §2 or via
    inline "see state-coverage-grid.md §X" pointers on each component spec — so
    a design-reviewer walking §2 top-to-bottom can find the corresponding state
    grid for every component without searching.
status: completed
bolt: 2
hat: designer
started_at: '2026-04-20T05:08:33Z'
hat_started_at: '2026-04-20T08:51:46Z'
iterations:
  - hat: designer
    started_at: '2026-04-20T05:08:33Z'
    completed_at: '2026-04-20T05:16:04Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T05:16:04Z'
    completed_at: '2026-04-20T05:18:24Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T05:18:24Z'
    completed_at: '2026-04-20T08:51:46Z'
    result: reject
    reason: >-
      FB-70 and FB-75 are both factually closed in the artifacts — DESIGN-BRIEF
      §7 (lines 887-917) no longer ships opacity 0.7/0.5 or raw hex (uses
      var(--color-green-400), var(--color-blue-400), var(--color-stone-500),
      var(--color-teal-600) tokens); state-coverage-grid.md §7.1–§7.12 has
      per-component sections for every DESIGN-BRIEF §2 component
      (FeedbackStatusBadge 4-status × 2-theme matrix, FeedbackOriginIcon
      six-origin variants,
      FeedbackList/FeedbackSheet/FeedbackSummaryBar/AgentFeedbackToggle full
      six-state coverage with inline N/A rationales). However, advance_hat
      blocks with 6 unchecked completion-criteria checkboxes in the unit
      frontmatter (lines 128-135 of
      unit-20-source-doc-opacity-and-grid-consistency.md). The
      designer/design-reviewer hats completed the work but left every
      "Completion criteria" checkbox unticked. Prior hat must tick all 6
      checkboxes so the hard gate passes on the next feedback-assessor pass.
  - hat: designer
    started_at: '2026-04-20T08:51:46Z'
    completed_at: null
    result: null
completed_at: '2026-04-20T09:21:29Z'
---
# Source-doc consistency — §7 CSS strip + state-coverage completeness

## Scope

Two findings describe source-of-truth documents contradicting themselves:

- **FB-70**: `DESIGN-BRIEF.md §7 "CSS Additions"` ships
  `opacity: 0.7` on `.feedback-item-closed` and `opacity: 0.5` on
  `.feedback-item-rejected` — the exact values the same document's §2
  "Banned Text-on-Surface Pairs" forbids. The §7 block also carries two raw
  hex literals (`#60a5fa`, `#4ade80`), which violates unit-16's no-raw-hex
  rule.
- **FB-75**: `state-coverage-grid.md` is the template DESIGN-BRIEF §2 itself
  declares non-negotiable for every new component, but the grid has zero
  rows for `FeedbackOriginIcon`, `FeedbackSummaryBar`, `AgentFeedbackToggle`,
  and incomplete coverage for `FeedbackStatusBadge`, `FeedbackList`, and
  `FeedbackSheet`. Downstream design-review walks become impossible because
  ~half the required components have no rows to walk.

## Approach

Designer hat:

1. **DESIGN-BRIEF §7 fix (FB-70)**: open the §7 CSS block, delete the two
   `opacity:` declarations, replace with the §2 remediation pattern already
   spelled out in the document (prefix + background token + full-opacity
   strikethrough). Replace the two raw hex literals with CSS-var / Tailwind
   token references defined in DESIGN-TOKENS.md §1.8.
2. **state-coverage-grid completeness (FB-75)**: read DESIGN-BRIEF §2
   component inventory end-to-end; for every component missing from the
   grid, add a dedicated section with the six-state table. For components
   with partial coverage, expand the row into a full table (badge → 4
   statuses × 2 themes; list container → empty + loading + error on top of
   visual states).
3. **Cross-ref bridging**: add "see state-coverage-grid.md §X" pointers
   inside DESIGN-BRIEF §2 so reviewers can jump from a component spec to
   its state grid without searching.

Design-reviewer hat verifies each quality gate with the grep commands
listed in the gate prose.

## Completion criteria

- [x] DESIGN-BRIEF.md §7 CSS strip has zero `opacity: 0.7` / `opacity: 0.5`
      (verified: `grep -nE 'opacity:\s*0\.[57]' stages/design/DESIGN-BRIEF.md`
      returns 0 hits; §7 closed/rejected selectors now use the `bg-green-50/60`
      + "Closed ·" prefix + ✓ glyph and `bg-stone-100` + "Rejected ·" prefix +
      full-opacity strikethrough pattern per bolt 1 commit `0c2c0fc3`).
- [x] DESIGN-BRIEF.md §7 CSS strip has zero raw hex literals
      (verified: every color value inside the §7 code fence is either a
      Tailwind utility class or a `var(--color-*)` token reference —
      `var(--color-blue-400)`, `var(--color-green-400)`,
      `var(--color-stone-500)`, `var(--color-teal-600)`. The hex values
      `grep` still reports sit inside §2 contrast-audit prose — descriptive,
      not code — which the gate prose explicitly excludes).
- [x] state-coverage-grid.md has dedicated sections for all DESIGN-BRIEF §2
      components (badge, origin icon, item compact/expanded, list,
      summary bar, agent toggle, sheet, FAB, FAB pulse) — §7.1–§7.12 in
      `stages/design/artifacts/state-coverage-grid.md` cover every §2
      component; `FeedbackStatusBadge` renders the full 4-status × 2-theme
      matrix; `FeedbackOriginIcon` renders all six origin variants;
      `FeedbackList` / `FeedbackSheet` / `FeedbackSummaryBar` /
      `AgentFeedbackToggle` carry the full six-state coverage required by
      gate 3–4. Added in bolt 1 commit `0382463a`.
- [x] Every grid cell is either a concrete state spec or `— (N/A: reason)`
      — §10 of state-coverage-grid explicitly states every N/A cell reads
      `— (N/A: <rationale>)` inline; bare em-dashes were swept during bolt 1.
- [x] DESIGN-BRIEF §2 cross-references the grid for each component
      — DESIGN-BRIEF.md lines 121–136 carry the "State-coverage
      cross-reference index (FB-75)" block with a pointer row for every
      §2 component, and inline `see state-coverage-grid.md §X` pointers
      appear on each component subheading (lines 175, 218, 252, 307, 347,
      366, …).
- [x] feedback-assessor verifies FB-70 and FB-75 against their original claims
      — previous bolt's feedback-assessor pass confirmed both findings are
      factually closed in the artifacts (see unit iteration log bolt 1
      feedback-assessor `reject` reason — the reject was specifically
      because these checkboxes were unticked, not because the work was
      incomplete). With all 6 boxes now ticked, the hard gate should pass.
