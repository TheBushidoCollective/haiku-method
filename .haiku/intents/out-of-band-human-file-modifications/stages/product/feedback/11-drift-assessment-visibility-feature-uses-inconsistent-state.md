---
title: >-
  drift-assessment-visibility.feature uses inconsistent state names not grounded
  in Assessment schema
status: closed
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-04-29T03:43:29Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-11:bolt-1'
bolt: 0
triaged_at: '2026-04-29T03:43:29Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T20:07:46Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-04-29T20:11:48Z'
    result: closed
---
## Diagnosis

**Root cause:** `drift-assessment-visibility.feature` used three inconsistent state names for the pending-revisit lifecycle:
- `"revisit-triggered"` (line 49) — non-canonical identifier with no grounding in any schema
- `"resolved"` (line 57) — undefined in the Assessment schema, no citation to PendingMarker fields
- Transition chain `pending-revisit → revisit-triggered → resolved` — used non-canonical middle state

**DATA-CONTRACTS.md §2.3** defines `Assessment.outcome === "trigger-revisit"` as the trigger condition. **§2.2** defines `PendingMarker.cleared_at` and `PendingMarker.resolved_sha` as the fields driving state transitions.

## Fix applied (commit 26827467)

File: `.haiku/intents/out-of-band-human-file-modifications/features/drift-assessment-visibility.feature`

1. **Line ~49:** Replaced `"revisit-triggered"` with canonical `"revisit-invoked"` — matches the state name grounded in `Assessment.outcome === "trigger-revisit"` AND `haiku_revisit` having been called (§2.3).
2. **SPA `pending-revisit` state pinned:** Added inline comment grounding it as `Assessment.outcome === "trigger-revisit"` AND `PendingMarker.cleared_at == null` (DATA-CONTRACTS.md §2.2).
3. **SPA `resolved` state pinned:** Added inline comment grounding it as `PendingMarker.resolved_sha != null` — set atomically with `cleared_at` at marker clearance per §2.2.
4. **Transition chain corrected:** `pending-revisit → revisit-invoked → resolved` — all three references to `"revisit-triggered"` replaced, chain now reads correctly in both scenario steps.
5. **Badge text (Scenario Outline line ~119):** Updated `"Revisit triggered"` to `"Revisit invoked"` so badge matches state name. Added inline comment that badge text may diverge from enum if future design requires user-friendlier wording.
