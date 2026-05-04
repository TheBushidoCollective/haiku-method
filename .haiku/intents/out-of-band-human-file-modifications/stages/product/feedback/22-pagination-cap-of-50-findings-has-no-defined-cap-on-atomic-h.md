---
title: >-
  Pagination cap of 50 findings has no defined cap on atomic
  haiku_classify_drift payload — unreasonable O(n) allocation
status: closed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T20:33:57Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-22:bolt-1'
bolt: 1
triaged_at: '2026-04-29T20:33:57Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T20:40:09Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-04-29T20:41:45Z'
    result: closed
---
**Mandate lens:** Performance targets must be realistic given the data model; no specification may assume capabilities that require unreasonable effort to build.

**Finding:**

`manual-change-assessment.feature` lines 159–166 specifies a pagination cap of 50 findings per `manual_change_assessment` dispatch:

> Then the action payload findings array contains the first 50 DriftFindings
> And the Agent classifies the first 50 findings
> And on the next tick the workflow emits a second "manual_change_assessment" with the remaining 10 findings

However, the `haiku_classify_drift` request schema in `DATA-CONTRACTS.md §4.3` accepts a `classifications` array with "one per dispatched finding, parallel-indexed," and the tool applies **all-or-rollback** atomicity ("Atomic side-effect ordering (all-or-rollback)").

The spec does not define:
1. A `batch_id` or cursor that ties a multi-tick pagination session together. Between tick 1 (50 findings classified) and tick 2 (remaining 10), the baseline can change: a human can write more files, markers can clear, or a concurrent assessment can fire. There is no field in `DriftFinding`, `Assessment`, or `manual_change_assessment` action payload that identifies "this is page 2 of batch X started at tick Y."
2. How the workflow engine knows which findings are "remaining" across a session restart between page 1 and page 2 (a real risk in interactive mode).
3. What happens if the human edits one of the page-1 findings again before page-2 completes. The baseline was already updated for the page-1 finding (if `ignore` or `inline-fix`); the page-2 tick would see a new drift event against the updated baseline and queue a third `manual_change_assessment` page, potentially diverging from the expected "second batch of the original 10."

The pagination model as specified is underdefined for multi-tick atomicity. Either the pagination scope must be defined (cursor, batch session ID, session affinity requirement) or the feature must be deferred to a later stage with explicit out-of-scope marking.

**Location:** `features/manual-change-assessment.feature` lines 159–166 (Pagination cap scenario); `DATA-CONTRACTS.md §4.3` (haiku_classify_drift request schema — no pagination cursor fields).
