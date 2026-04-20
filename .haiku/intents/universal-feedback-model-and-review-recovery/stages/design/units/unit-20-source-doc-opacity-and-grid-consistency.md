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
status: active
bolt: 5
hat: feedback-assessor
started_at: '2026-04-20T05:08:33Z'
hat_started_at: '2026-04-20T09:12:45Z'
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
    completed_at: '2026-04-20T08:54:39Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T08:54:39Z'
    completed_at: '2026-04-20T08:57:25Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T08:57:25Z'
    completed_at: '2026-04-20T08:59:08Z'
    result: reject
    reason: >-
      FB-70 and FB-75 are both factually closed in the artifacts — DESIGN-BRIEF
      §7 CSS strip (lines 882-930) has zero `opacity: 0.7`/`0.5` and zero raw
      hex inside the code fences (uses `var(--color-green-400)`,
      `var(--color-blue-400)`, `var(--color-stone-500)`,
      `var(--color-teal-600)`); state-coverage-grid.md §7.1–§7.12 has
      per-component sections for every DESIGN-BRIEF §2 component, with
      FeedbackStatusBadge 4-status × 2-theme matrix, FeedbackOriginIcon
      six-origin variants,
      FeedbackList/FeedbackSheet/FeedbackSummaryBar/AgentFeedbackToggle full
      six-state coverage with inline `— (N/A: <rationale>)` text; DESIGN-BRIEF
      §2 has the cross-reference index block plus inline `see
      state-coverage-grid.md §X` pointers on each component subheading. However,
      advance_hat blocks with 6 unchecked completion-criteria checkboxes. The
      prior hat ticked the checkboxes in the unit-worktree copy
      (`.haiku/worktrees/universal-feedback-model-and-review-recovery/unit-20-source-doc-opacity-and-grid-consistency/.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/units/unit-20-source-doc-opacity-and-grid-consistency.md`
      — shows all `[x]`) but the FSM reads the parent-worktree intent copy
      (`.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/units/unit-20-source-doc-opacity-and-grid-consistency.md`
      — still shows all `[ ]` on lines 156, 157, 158, 161, 162, 163). Prior hat
      must tick the 6 checkboxes in the parent-worktree copy (or ensure the
      unit-worktree edits propagate to it) so the hard gate passes on the next
      feedback-assessor pass.
  - hat: designer
    started_at: '2026-04-20T08:59:08Z'
    completed_at: '2026-04-20T09:01:16Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T09:01:16Z'
    completed_at: '2026-04-20T09:02:29Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T09:02:29Z'
    completed_at: '2026-04-20T09:04:35Z'
    result: reject
    reason: >-
      FB-70 and FB-75 are factually closed in the worktree artifacts —
      DESIGN-BRIEF.md §7 CSS block (lines 882-930) has zero `opacity: 0.7/0.5`
      and zero raw hex (uses `var(--color-blue-400)`, `var(--color-green-400)`,
      `var(--color-stone-500)`, `var(--color-teal-600)`); hex hits at lines
      774-781 are in §2 contrast-audit prose, explicitly excluded by gate 2.
      state-coverage-grid.md §7.1–§7.12 covers every §2 component
      (FeedbackStatusBadge 4-status × 2-theme, FeedbackOriginIcon six origins,
      FeedbackList/FeedbackSheet/FeedbackSummaryBar/AgentFeedbackToggle full
      six-state + empty/loading/error with inline `— (N/A: rationale)`);
      DESIGN-BRIEF §2 cross-ref index at lines 121-136 plus inline pointers at
      175/218/252/307/347/366. However, `haiku_unit_advance_hat` reports 6
      unchecked completion-criteria boxes — the worktree copy of the unit file
      has `[x]` on all 6, but the repo-root copy at
      `.haiku/intents/.../units/unit-20-*.md` still has `[ ]` on all 6 (lines
      190-197). Designer ticked the boxes in the worktree but the harness
      validates against the root path, so the hard gate still blocks. Prior hat
      must tick the 6 checkboxes at the root path
      (`.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/units/unit-20-source-doc-opacity-and-grid-consistency.md`
      lines 190-197) — not just the worktree copy — so advance_hat passes on the
      next feedback-assessor pass. The FB-70 / FB-75 artifact fixes themselves
      are sound and do not need re-work.
  - hat: designer
    started_at: '2026-04-20T09:04:35Z'
    completed_at: '2026-04-20T09:05:25Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T09:05:25Z'
    completed_at: '2026-04-20T09:08:04Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T09:08:04Z'
    completed_at: '2026-04-20T09:09:50Z'
    result: reject
    reason: >-
      FB-70 and FB-75 are factually closed in the artifacts (DESIGN-BRIEF.md §7
      has zero `opacity: 0.7`/`opacity: 0.5` and zero raw hex inside CSS fences;
      state-coverage-grid.md §7.1–§7.12 covers every §2 component with the
      required matrices and inline N/A rationales; DESIGN-BRIEF §2 lines 121–136
      carry the cross-reference index plus inline `see state-coverage-grid.md
      §X` pointers on each component subheading). However, advance_hat fails
      with `criteria_not_met: 6 unchecked` because the designer ticked the 6
      "Completion criteria" checkboxes in the UNIT WORKTREE copy only
      (`.haiku/worktrees/.../unit-20.../.haiku/intents/.../units/unit-20-....md`
      lines 148–178) — the canonical main-tree copy at
      `.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/units/unit-20-source-doc-opacity-and-grid-consistency.md`
      lines 224–231 still carries 6 `- [ ]` boxes. The next designer bolt must
      tick the six checkboxes in the MAIN-TREE unit-spec file (not just the
      worktree copy) so the harness gate probe sees them checked. The artifacts
      themselves need no further changes.
  - hat: designer
    started_at: '2026-04-20T09:09:50Z'
    completed_at: '2026-04-20T09:10:48Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T09:10:48Z'
    completed_at: '2026-04-20T09:12:44Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T09:12:45Z'
    completed_at: null
    result: null
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

- [ ] DESIGN-BRIEF.md §7 CSS strip has zero `opacity: 0.7` / `opacity: 0.5`
- [ ] DESIGN-BRIEF.md §7 CSS strip has zero raw hex literals
- [ ] state-coverage-grid.md has dedicated sections for all DESIGN-BRIEF §2
      components (badge, origin icon, item compact/expanded, list,
      summary bar, agent toggle, sheet, FAB, FAB pulse)
- [ ] Every grid cell is either a concrete state spec or `— (N/A: reason)`
- [ ] DESIGN-BRIEF §2 cross-references the grid for each component
- [ ] feedback-assessor verifies FB-70 and FB-75 against their original claims
