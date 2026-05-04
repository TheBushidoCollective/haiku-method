---
title: >-
  Assessment append-only guarantee contradicts mutable resulting_sha for
  non-terminal outcomes
status: closed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T03:42:04Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-03:bolt-1'
bolt: 0
triaged_at: '2026-04-29T03:42:04Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T20:09:46Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-04-29T20:12:06Z'
    result: closed
---
## Root cause

`Assessment.resulting_sha` was described as append-only in the header of §2.3 ("records are never modified after writing") but then described as mutable in the same section for non-terminal outcomes — populated at marker-clearance time. This is a schema-level invariant violation: two mutually exclusive contracts on the same field in the same record type.

Two pieces of state were colliding on a single `Assessment` record. The `Assessment` captures the agent's decision at classification time (what changed, what was decided, why — per DEC-9). The post-clearance SHA is a *later* event that belongs on the clearance side, not retroactively on the immutable audit record.

## Fix applied

**Option chosen:** Keep `Assessment` truly append-only; move the post-clearance SHA to `PendingMarker.resolved_sha`.

### DATA-CONTRACTS.md changes

- **§2.3 `Assessment.resulting_sha`**: Typed as `string | null`. For terminal outcomes (`ignore`, `inline-fix`) it is the on-disk SHA at classification time. For non-terminal outcomes (`surface-as-feedback`, `trigger-revisit`) it is `null` — set once at creation, never updated. Append-only invariant restored.
- **§2.2 `PendingMarker`**: Added `resolved_sha: string | null` field — `null` while pending, populated atomically with `cleared_at` at clearance time, never mutated after. Added explicit "Mutation contract" note clarifying the intentional not-append-only nature of `PendingMarker` (only `cleared_at` + `resolved_sha` mutate, exactly once together).
- **§4.3 side-effect ordering**: Steps 4 and 6 now explicitly state that `Assessment.resulting_sha` is `null` for non-terminal outcomes and the resolved SHA lands on `PendingMarker.resolved_sha` at clearance.
- **§4.4 `haiku_baseline_clear_marker`**: Added explicit "Side effects" section documenting the atomic write of `cleared_at` + `resolved_sha`, baseline update, and event emission. Added explicit statement: "The `Assessment` record is never modified by this tool." Response now includes `resolved_sha`.
- **§6.3 `pending_marker_cleared` event**: Added `resolved_sha` field to payload table with a note that this is the canonical post-resolution SHA for non-terminal-outcome assessments.
- **§7 cross-surface naming audit**: Added `resolved_sha` row (`PendingMarker.resolved_sha` on disk, `resolved_sha` in §4.4 response and §6.3 event).

### Feature file changes

- **`assessment_schema.feature`**: Schema completeness scenario updated (`resulting_sha` type changed to "string or null"). Deleted contradicting scenario "resulting_sha is updated at marker-clearance time for non-terminal outcomes". Replaced with two scenarios: (1) `resulting_sha` is `null` at classification time for non-terminal outcomes, (2) `Assessment.resulting_sha` remains `null` after marker clearance while `PendingMarker.resolved_sha` holds the post-clearance SHA.
- **`mcp_tools.feature`** (haiku_baseline_clear_marker scenario): Replaced "Assessment record's resulting_sha is updated to the same current on-disk SHA" with "PendingMarker's resolved_sha is set to the current on-disk SHA" and "Assessment record's resulting_sha remains null (Assessment is append-only and never modified)".
- **`pending_marker_schema.feature`**: Schema completeness scenario updated to include `resolved_sha: string or null`. Added four new scenarios for the `resolved_sha` lifecycle: null while open, populated atomically at clearance, never mutated after clearance, and `cleared_at` + `resolved_sha` set together exactly once.

## Result

Single coherent model: `Assessment` is now truly append-only with no internal contradiction. The post-resolution SHA for non-terminal outcomes lives exclusively on `PendingMarker.resolved_sha` and is carried through the `pending_marker_cleared` event. All surfaces (§2, §4, §6, §7) and Gherkin specs agree.
