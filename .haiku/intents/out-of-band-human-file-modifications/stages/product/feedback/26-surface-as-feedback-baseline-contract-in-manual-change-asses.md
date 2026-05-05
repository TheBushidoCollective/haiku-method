---
title: >-
  surface-as-feedback baseline contract in manual-change-assessment.feature
  still incorrect after FB-08 addressed
status: closed
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-04-29T20:35:51Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-26:bolt-2'
bolt: 2
triaged_at: '2026-04-29T20:35:51Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: product
    completed_at: '2026-04-29T21:44:43Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-04-29T21:46:10Z'
    result: closed
---
## Finding

`features/manual-change-assessment.feature` line 45 states:

```
And the baseline SHA for "stages/design/artifacts/dashboard-layout.html" IS updated atomically to the post-drift SHA at classification time
```

This directly contradicts `DATA-CONTRACTS.md` §3.5 (`surface-as-feedback` baseline-update contract) and §4.3 atomic side-effect ordering step 6, both of which state:

> When `Assessment.outcome === "surface-as-feedback"`, the `Baseline` row is **NOT updated at classification time**. A `PendingMarker` is written atomically with the `Assessment` record. The `Baseline` is left unchanged.

**Prior fix attempt:** FB-08 (same issue) was logged by this review agent and marked `addressed`. However, the fix was not applied — the contradictory step at line 45 is still present on disk. The `addressed` status did not result in the file being corrected.

**Impact on completeness:** A developer implementing the step-definition layer will receive two conflicting instructions:
- The scenario step says: baseline updated immediately.
- DATA-CONTRACTS §3.5 says: baseline deferred until marker clearance.

These cannot both be true. A test written against the feature file will pass a non-compliant implementation that updates the baseline immediately. The behavioral spec is non-testable as written because its scenario step directly violates the data contract it is supposed to verify.

**Required resolution:** Replace line 45 in `features/manual-change-assessment.feature`:

Wrong:
```
And the baseline SHA for "stages/design/artifacts/dashboard-layout.html" IS updated atomically to the post-drift SHA at classification time
```

Correct (per DATA-CONTRACTS.md §3.5):
```
And the baseline SHA for "stages/design/artifacts/dashboard-layout.html" is NOT updated at classification time
And the deferred baseline update will occur when the pending-assessment marker clears (via haiku_baseline_clear_marker)
```

**References:** `features/manual-change-assessment.feature` line 45; `stages/product/outputs/DATA-CONTRACTS.md` §3.5, §4.3 step 6; `product/ACCEPTANCE-CRITERIA.md` AC-G4 (baseline-update contract by outcome).
