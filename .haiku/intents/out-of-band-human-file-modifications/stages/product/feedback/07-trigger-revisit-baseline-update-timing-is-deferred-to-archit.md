---
title: >-
  trigger-revisit baseline update timing is deferred to ARCHITECTURE.md §5.4
  which is not a product-stage artifact
status: closed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T03:42:47Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-07:bolt-1'
bolt: 0
triaged_at: '2026-04-29T03:42:47Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T20:10:21Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-04-29T20:11:29Z'
    result: closed
---
## Diagnosis

**Root cause:** DATA-CONTRACTS.md §4.3 step 7 (atomic side-effects of `haiku_classify_drift`) referenced ARCHITECTURE.md §5.4 for the `trigger-revisit` baseline-update timing rule. That file is a design-stage artifact not in the product-stage output set. Additionally, the `Assessment` schema had no field for tracking when `haiku_revisit` was invoked, leaving an unspecified intermediate state between classification and revisit-completion. The gap meant implementors could not determine what value `resulting_sha` should hold for `trigger-revisit` outcomes at write time vs. post-clearance.

**Fix applied (commit 9a4bf885):**

1. **Added §3.6** — `trigger-revisit` baseline-update timing, self-contained within DATA-CONTRACTS.md. Defines the four-step atomic ordering: classification → revisit-invoked → revisit-complete → marker-clear. No cross-reference to any design-stage artifact.

2. **Added `Assessment.revisit_invoked_at` field** (§2.3) — `null` at write time, stamped when `haiku_revisit` fires on the next tick. Append-only. Resolves the "what value does the Assessment hold during the gap" question — the field tracks progress through the timing lifecycle.

3. **Added `PendingMarker.resolved_sha` semantics table** (§3.6) — explicitly states that `resolved_sha` is `null` for `feedback-closed`/`feedback-rejected` triggers and holds the on-disk SHA-256 for `revisit-complete`. Resolves the `resulting_sha` gap from the finding.

4. **Added `(outcome, trigger)` legality matrix** (§4.4) — defines which `trigger` values are valid per `PendingMarker.outcome`. `surface-as-feedback` accepts `feedback-closed`/`feedback-rejected` only; `trigger-revisit` accepts `revisit-complete` only. Mismatched pairs return `trigger_outcome_mismatch` error.

5. **Updated §4.3 step 6** — replaced "see §4.4" deferred reference with explicit cites to both §3.6 (timing contract) and §4.4 (clearance mechanism).

All changes are in the product-stage artifact. No design-stage cross-reference remains.
