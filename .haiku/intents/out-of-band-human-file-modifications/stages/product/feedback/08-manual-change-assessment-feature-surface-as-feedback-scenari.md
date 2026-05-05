---
title: >-
  manual-change-assessment.feature surface-as-feedback scenario has wrong
  baseline contract
status: addressed
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-04-29T03:42:52Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-04-29T03:42:52Z'
resolution: null
replies: []
hat: product
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T03:48:01Z'
    result: advanced
---
## Finding

`manual-change-assessment.feature` line 45 states:

> "the baseline SHA for 'dashboard-layout.html' is NOT updated at classification time"

This directly contradicts the authoritative data contracts and accepted reconciliation requirement.

**DATA-CONTRACTS.md §3.5** (surface-as-feedback baseline-update contract, normative):

> When `Assessment.outcome === "surface-as-feedback"` (specifically: when the `haiku_classify_drift` tool writes the `Classification` with that outcome), the `Baseline` row for the affected file is **updated to the post-drift SHA at the same time the assessment is recorded** — this is an atomic write.

**Unit-01 AC-G7** (as encoded in the acceptance criteria reconciliation):

> The AC explicitly states `surface-as-feedback` does NOT update baseline at classification time — verifiable by grep

Wait — this is where the ambiguity lies. Unit-01 acceptance criteria scope says AC must state "surface-as-feedback does NOT update baseline at classification time," citing the pending-marker mechanism. But DATA-CONTRACTS.md §3.5 and the haiku_classify_drift atomic side-effect step 6 (§4.3) says it DOES atomically update the baseline when classifying as surface-as-feedback.

The two documents are internally contradictory:
- `manual-change-assessment.feature` line 45: baseline NOT updated at classification time (consistent with unit-01 completion criteria wording)
- `DATA-CONTRACTS.md §3.5` and §4.3 step 6: baseline IS updated atomically at classification time for `surface-as-feedback`
- `mcp_tools.feature` lines 194–198 (outputs/features): baseline IS updated ("baselines_updated" = 1 for surface-as-feedback)

This is a spec completeness failure: the behavioral specification is self-contradictory on a core workflow invariant. Unit-02 reconciliation requirement 5 requires a load-bearing scenario asserting the baseline update — but `manual-change-assessment.feature` (the authoritative unit-02 deliverable) explicitly asserts the opposite.

## Required fix

The scenarios must be reconciled to one authoritative position. Based on DATA-CONTRACTS.md §3.5 and §4.3 (which both say the baseline IS updated atomically for surface-as-feedback), `manual-change-assessment.feature` must be corrected:

Line 45 should read: "And the baseline SHA for 'stages/design/artifacts/dashboard-layout.html' IS updated atomically to the post-drift SHA at classification time"

The scenario at lines 48–54 ("surface-as-feedback baseline is updated when feedback reaches a terminal state") describes the pending-marker clearance — that scenario is about the marker clearing, which is separate from the initial baseline update. Both can be true: baseline updates at classification, AND marker clears at `addressed`.
