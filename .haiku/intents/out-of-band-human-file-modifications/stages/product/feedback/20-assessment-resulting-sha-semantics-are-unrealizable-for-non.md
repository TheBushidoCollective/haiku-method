---
title: Assessment.resulting_sha semantics are unrealizable for non-terminal outcomes
status: closed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T20:33:24Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-20:bolt-1'
bolt: 1
triaged_at: '2026-04-29T20:33:24Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T20:39:14Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-04-29T20:40:34Z'
    result: closed
---
**Mandate lens:** Specified behavior must be implementable within the technical constraints; no assumption may require unreasonable effort to build.

**Finding:**

`DATA-CONTRACTS.md §2.3` defines `Assessment.resulting_sha` as a required field (no nullable). The description states:

> For non-terminal outcomes, updated at marker-clearance time.

This is not implementable as defined. `Assessment` records are explicitly described in the same section as **append-only** ("Append-only. The durable record of what changed... records are never modified after writing"). The `Storage reference` in §2.3 says records are written as individual JSON files (`DA-NN.json`) and are intended to be immutable ("survive session restarts and worktree branch switches" is a feature requirement in `drift-assessment-visibility.feature`).

If the record is append-only and the file is immutable, the `resulting_sha` field cannot be "updated at marker-clearance time" — that would require mutating an immutable append-only record, which the spec explicitly forbids.

**Options the spec does not choose between:**
- The field is nullable at write time (e.g., `resulting_sha: null`) and the field table must mark it as `required: no` / `default: null`
- A separate sidecar record is written at clearance time (not an update to the original)
- The "append-only" constraint is relaxed for this specific field (requires an explicit carve-out)

None of these are specified. Development stage will either mutate an "immutable" record (violating the audit requirement) or leave `resulting_sha` null for non-terminal outcomes (violating the `required: yes` constraint).

**Location:** `DATA-CONTRACTS.md §2.3`, `Assessment.resulting_sha` field row and surrounding prose.
