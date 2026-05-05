---
title: >-
  silent-filesystem-drop-detection.feature contradicts DATA-CONTRACTS.md on
  marker-clearing trigger
status: addressed
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-04-29T03:42:33Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-04-29T03:42:33Z'
resolution: null
replies: []
hat: product
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T03:46:42Z'
    result: advanced
---
## Finding

`silent-filesystem-drop-detection.feature` (lines 160–175) explicitly states that a pending-assessment marker is **NOT** cleared when feedback transitions to `addressed`, and IS cleared when it transitions to `closed`. This directly contradicts the authoritative data contract.

**DATA-CONTRACTS.md §4.4** (reconciliation requirement R5, normative):

> The tool fires when feedback transitions to `addressed` (a mid-lifecycle state, not just `closed`). A pending marker is cleared as soon as the human fix lands — not when the human formally closes the feedback.

**Unit-01 acceptance criteria** (via unit-03 R5):

> `addressed` (mid-state in the lifecycle) clears the marker; `addressed` does NOT (because addressed FBs can still be reopened)

The feature file has the rule exactly backwards:

- Line 160–165: "Pending-assessment marker is NOT cleared when feedback transitions to addressed" — WRONG per contracts
- Lines 167–175: "Pending-assessment marker is cleared when feedback transitions to closed" — WRONG per contracts (should fire at `addressed`, not `closed`)

The `mcp_tools.feature` and `pending_marker_schema.feature` in `outputs/features/` correctly show `feedback-addressed` as the primary trigger (mcp_tools.feature lines 255–263). This creates an internal contradiction across the behavioral spec artifacts.

## Impact

This is a completeness failure: a critical user-facing flow (the lifecycle of human fixes landing before formal feedback closure) is specified with the wrong behavior. Development stage will implement incorrect marker-clearing logic if this feature file is authoritative.

## Required fix

In `silent-filesystem-drop-detection.feature`, the two scenarios at lines 160–175 must be corrected:
- Scenario "marker is NOT cleared on addressed" → change to "marker IS cleared on addressed"
- Scenario "marker IS cleared on closed" → change to "marker IS also cleared on closed (fallback, after addressed fires)"

Or restructure to match the `haiku_baseline_clear_marker` trigger contract exactly: `feedback-addressed` is the primary trigger; `feedback-closed` and `feedback-rejected` are fallback triggers.
