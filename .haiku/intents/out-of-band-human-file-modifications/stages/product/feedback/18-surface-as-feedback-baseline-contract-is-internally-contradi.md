---
title: >-
  surface-as-feedback baseline contract is internally contradictory across
  DATA-CONTRACTS and feature files
status: addressed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T20:32:52Z'
iteration: 2
visit: 2
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-04-29T20:32:52Z'
resolution: null
replies: []
hat: product
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T20:40:26Z'
    result: advanced
---
**Mandate lens:** Data contracts must be compatible with each other — no breaking contradictions without explicit resolution.

**Finding:**

`DATA-CONTRACTS.md §3.5` (the surface-as-feedback baseline-update contract, reconciliation requirement R6) states:

> When `Assessment.outcome === "surface-as-feedback"`, the `Baseline` row for the affected file is **NOT updated at classification time**. Instead, a `PendingMarker` is written atomically with the `Assessment` record.

However, `manual-change-assessment.feature` at line 45 states the exact opposite for the same scenario:

> `And the baseline SHA for "stages/design/artifacts/dashboard-layout.html" IS updated atomically to the post-drift SHA at classification time`

These two normative artifacts define opposite behavior for the same event. `DATA-CONTRACTS.md §0.3` also lists "surface-as-feedback" as "baseline deferred," aligning with the prose in §3.5 — but the feature scenario directly contradicts both.

**Impact:** Development stage will implement one of these contracts and silently break the other. The re-detection suppression mechanism (PendingMarker) is designed specifically to handle the case where the baseline is NOT updated. If the baseline IS updated on classification (as the feature scenario says), then the PendingMarker's suppression logic is redundant and the system has no way to detect subsequent edits to the same file while feedback is open. The §3.5 contract explicitly addresses "re-detection of subsequent edits while a marker is open" — this entire sub-section becomes meaningless if the baseline is updated at classification time.

**Location:** `DATA-CONTRACTS.md §3.5` (normative prose) vs. `features/manual-change-assessment.feature` line 45 (Scenario: Agent classifies an out-of-spec change as surface-as-feedback).
