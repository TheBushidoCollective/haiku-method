---
title: >-
  AC-G5-A (trigger-revisit active-stage transition) is Open/Deferred with no
  resolution path
status: closed
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-04-29T20:36:22Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-27:bolt-2'
bolt: 2
triaged_at: '2026-04-29T20:36:22Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: product
    completed_at: '2026-04-29T21:46:23Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-04-29T21:47:45Z'
    result: closed
integrator_attempts: 1
---
## Finding

`product/ACCEPTANCE-CRITERIA.md` AC-G5-A is explicitly marked **Open / Deferred** with the following rationale:

> "The unit spec for this artifact called for an explicit AC describing the active-stage state while a `trigger-revisit` pending-assessment marker is open. At the time of writing, ARCHITECTURE.md §5 has only §5.1–§5.4. It does NOT yet name an active-stage state for the pending-revisit window, and it does not contain a §5.5."

**Why this is a completeness gap:** Unit-01 explicitly required this AC as a completion criterion (#7): "AC explicitly states the active-stage transition during a pending `trigger-revisit` marker (whatever ARCHITECTURE.md §5.5 names — `awaiting-revisit-resolution` or equivalent)." The ACCEPTANCE-CRITERIA document acknowledges it was required but deferred to an undefined upstream section with no resolution path.

The problem is circular: AC-G5-A defers to ARCHITECTURE.md §5.5 which doesn't exist, and no feedback was logged against the design stage to add §5.5, so the gap perpetuates without closure.

**Impact on completeness:** The behavioral spec has a scenario in `drift-assessment-visibility.feature` (the `pending-revisit` → `revisit-invoked` transition) but no AC that makes the active-stage workflow behavior during that window concrete. A developer cannot determine from the product-stage artifacts alone:
- Whether the active stage's workflow position changes while a `trigger-revisit` marker is open.
- Whether advancement is blocked, continues normally, or transitions to a distinct state.
- What the SPA should render for the workflow position (as opposed to the assessment row's badge).

**Required resolution (either path closes it):**
1. Log a finding against the design stage to add ARCHITECTURE.md §5.5 naming the active-stage state, then rewrite AC-G5-A as a concrete testable Given/When/Then.
2. Or: explicitly declare in the product stage that no special active-stage state is introduced — the marker is the sole suppression mechanism — and rewrite AC-G5-A with that ruling as the concrete assertion.

**References:** `product/ACCEPTANCE-CRITERIA.md` AC-G5-A (lines 218–224); `features/drift-assessment-visibility.feature` (pending-revisit scenarios); `product/COVERAGE-MAPPING.md` (trigger-revisit SC rows); unit-01 completion criterion #7.
