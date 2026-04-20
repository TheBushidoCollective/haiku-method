---
title: >-
  FeedbackSummaryBar has grid row (§7.6) and §9 file entry but no rendered HTML
  artifact showing its 6-state coverage
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T17:53:25Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

DESIGN-BRIEF §2 state-coverage requirement: "Every new component in this intent … MUST ship with a six-state grid (default / hover / focus / active / disabled / error) **rendered alongside its component spec**." DESIGN-BRIEF §2 "FeedbackSummaryBar" block (L319-336) gives a textual spec but no visual rendering.

Stage-wide check:
- `grep -l 'FeedbackSummaryBar' stages/design/artifacts/*.html` → `review-package-structure.html` only (and that file just enumerates files, it doesn't visualize the component).
- State-coverage-grid §7.6 has a row for `FeedbackSummaryBar` with 6 columns but no visible art sample.

Every sibling component in §2 ships a rendered artifact:
- `FeedbackStatusBadge` → `feedback-card-states.html` (4 status-variant swatches).
- `FeedbackOriginIcon` → `feedback-inline-desktop.html` / `…-mobile.html` (6 origin-variant swatches).
- `FeedbackItem` → `feedback-card-states.html` (compact + expanded renders per status).
- `FeedbackList` → `feedback-inline-desktop.html` / `comments-list-with-agent-toggle.html`.
- `AgentFeedbackToggle` → `agent-feedback-toggle-spec.html` (dedicated 6-state spec sheet).
- `FeedbackSheet` → `feedback-inline-mobile.html`.
- `FeedbackFloatingButton` → `feedback-inline-mobile.html` (FAB variant rendered).
- `AssessorSummaryCard` → `assessor-summary-card.html` (dedicated spec).
- `StageProgressStrip` → `stage-progress-strip.html` (dedicated).
- `RevisitModal` → `revisit-modal-spec.html`, `revisit-modal-states.html`.

`FeedbackSummaryBar` is the only §2 component that has no rendered visual. Dev stage implementing it has nothing to compare against at design-review time — the six-state grid row is verifiable only in prose.

Fix: add a compact `feedback-summary-bar.html` (or extend an existing artifact) that renders the six states inline, so the state-coverage grid row has something visual to cross-reference. Suggested layout: 3-row × 6-col matrix — Row 1: populated (pending · addressed · closed states rendered); Row 2: hover + focus + active + disabled; Row 3: error fallback (API-fail → hidden per §7.6 rationale). The file can be small (~3 KB); the goal is visual coverage parity with the other 11 §2 components.

Post-fix: add to `state-coverage-grid.md §0` checklist Row 5: `FeedbackSummaryBar | §7 + feedback-summary-bar.html`.
