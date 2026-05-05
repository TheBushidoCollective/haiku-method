---
title: surface-as-feedback baseline update contract is contradictory across artifacts
status: addressed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T03:41:43Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-04-29T03:41:43Z'
resolution: null
replies: []
hat: product
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T03:48:24Z'
    result: advanced
---
## Finding

DATA-CONTRACTS.md §3.5 (R6 contract) explicitly states: when `haiku_classify_drift` records a `surface-as-feedback` classification, the `Baseline` row is **atomically updated to the post-drift SHA at the same time the assessment is recorded**. This is described as an atomic write that prevents the next tick from re-detecting the same drift.

However, `manual-change-assessment.feature` (line 469) asserts: "the baseline SHA for `stages/design/artifacts/dashboard-layout.html` is NOT updated at classification time." This scenario is under the `surface-as-feedback` outcome block.

These two statements are directly contradictory. The feature file says baseline is NOT updated; the data contract says it IS updated (atomically). Unit-01 acceptance criteria references AC-G7 encoding this contract, but the behavioral spec implements the opposite rule.

**Impact:** Development will receive contradictory requirements. Whichever they implement, either drift re-detection will fire repeatedly on the same change (if baseline not updated), or the pending-marker suppression mechanism is redundant (if baseline is updated). Both cannot be true simultaneously.

**Fix required:** One document must be brought into alignment. The DATA-CONTRACTS.md R6 language is more detailed and internally consistent — the feature scenario likely carries a drafting error. The `manual-change-assessment.feature` scenario must be corrected to state the baseline IS updated at `surface-as-feedback` classification time, and a separate scenario must confirm the pending-marker is ALSO written to suppress re-detection of further divergences while the feedback is open.
