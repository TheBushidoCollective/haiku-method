---
title: >-
  haiku_baseline_clear_marker trigger contract contradicts itself within
  DATA-CONTRACTS.md
status: closed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T20:33:09Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-19:bolt-1'
bolt: 1
triaged_at: '2026-04-29T20:33:09Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T20:39:55Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-04-29T20:41:26Z'
    result: closed
---
**Mandate lens:** Edge cases must have defined behavior, not "handle gracefully." A tool whose own spec contradicts itself has undefined behavior for the triggering condition.

**Finding:**

`DATA-CONTRACTS.md §4.4` (`haiku_baseline_clear_marker`) defines two contradictory trigger rules in the same section:

1. Reconciliation requirement R5 prose (§4.4, paragraph under "Reconciliation requirement R5 — trigger contract") states:
   > The tool fires when feedback transitions to `addressed` (a mid-lifecycle state, not just `closed`). A pending marker is cleared as soon as the human fix lands.

2. The `trigger` field table in §4.4 lists the trigger values as: `"feedback-addressed" | "feedback-closed" | "feedback-rejected" | "revisit-complete"` — but the description says `feedback-closed` and `feedback-rejected` are "fallback triggers if the marker was not cleared at `addressed` transition."

3. The `pending_marker_cleared` event in §6.3 also includes `"feedback-addressed"` as a valid trigger value.

However, the feature files (`manual-change-assessment.feature` lines 53–75 and `silent-filesystem-drop-detection.feature` lines 162–185) explicitly require the OPPOSITE: `addressed` does NOT clear the marker; only `closed` and `rejected` are terminal triggers.

The feature files include an explicit comment:
> Rationale: `addressed` is a mid-state that can be reopened; only terminal states guarantee the immutability required to safely update the baseline.

**Impact:** The tool's own specification has undefined behavior at the most important decision point: when exactly does the marker clear? "Addressed" being a trigger means every `addressed` transition clears the marker. "Addressed" NOT being a trigger means double-edits during the feedback open window will fire fresh drift events. These are fundamentally different runtime semantics. Development will pick one and the other half of the spec will silently be wrong.

**Location:** `DATA-CONTRACTS.md §4.4` (R5 trigger prose vs. feature files `manual-change-assessment.feature:53-75` and `silent-filesystem-drop-detection.feature:162-185`).
