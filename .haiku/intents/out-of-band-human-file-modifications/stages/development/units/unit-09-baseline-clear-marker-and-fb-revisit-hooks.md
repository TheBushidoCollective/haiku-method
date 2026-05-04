---
title: haiku_baseline_clear_marker + feedback/revisit lifecycle hooks
model: sonnet
depends_on:
  - unit-02-drift-markers-storage
  - unit-08-haiku-classify-drift-tool
inputs:
  - intent.md
  - knowledge/ARCHITECTURE.md
  - stages/design/artifacts/ARCHITECTURE.md
  - product/ACCEPTANCE-CRITERIA.md
  - product/DATA-CONTRACTS.md
  - features/manual-change-assessment.feature
  - features/silent-filesystem-drop-detection.feature
outputs:
  - packages/haiku/src/orchestrator/workflow/baseline-clear-marker.ts
  - packages/haiku/src/state-tools.ts
  - packages/haiku/src/orchestrator/revisit.ts
  - packages/haiku/test/baseline-clear-marker.test.mjs
quality_gates:
  - name: biome
    command: >-
      bunx biome check
      packages/haiku/src/orchestrator/workflow/baseline-clear-marker.ts
  - name: typecheck
    command: bun run --cwd packages/haiku typecheck
  - name: unit-tests
    command: bun run --cwd packages/haiku test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku/src/orchestrator/workflow/baseline-clear-marker.ts
status: completed
completed_at: '2026-04-30T22:25:58Z'
---
# haiku_baseline_clear_marker + feedback/revisit lifecycle hooks

## Scope

Implement the internal lifecycle handler that clears pending-assessment markers when their downstream actions resolve, and wire it into the existing feedback-status and revisit-completion paths. This closes AC-G5 (terminal feedback states clear; `addressed` does NOT) and AC-TR2 (revisit completion clears the marker).

Deliverables:

1. **`baseline-clear-marker.ts`** exports `clearMarkerForResolution(intentDir, pathRel, trigger)` per DATA-CONTRACTS.md §4.4:
   - Trigger enum: `"feedback-closed"` | `"feedback-rejected"` | `"revisit-complete"`.
   - Reads the open marker for `pathRel` via `findOpenMarker` from unit-02. Returns `{ ok: true, marker_cleared: false, reason: "no_open_marker" }` when no open marker exists (idempotent retry).
   - Validates `(outcome, trigger)` legality matrix (DATA-CONTRACTS.md §4.4): `surface-as-feedback` accepts `feedback-closed` and `feedback-rejected`; `trigger-revisit` accepts only `revisit-complete`. Returns `trigger_outcome_mismatch` error when the trigger does not match.
   - Reads the on-disk SHA-256 for `pathRel`.
   - In a single atomic write: sets `PendingMarker.cleared_at = now()` and `PendingMarker.resolved_sha = currentSha` (DATA-CONTRACTS.md §2.2 — these two fields are always set together and never updated after this point).
   - Updates `baseline.json` for the owning stage to `(currentSha, currentBytes, currentMtimeNs, isBinary)` with `author_class: "human-implicit"` (preserving the originating class if the marker carries one; default `human-implicit`) and `acknowledged_via: "classification-terminal"`.
   - **Does NOT modify the `Assessment` record** — `Assessment.resulting_sha` stays `null` for non-terminal outcomes; the post-clearance SHA lives exclusively on `PendingMarker.resolved_sha` and the emitted event payload.
   - Emits a `pending_marker_cleared` event (DATA-CONTRACTS.md §6.3) with `path`, `assessment_id`, `trigger`, `linked_feedback_id`, `linked_revisit_target_stage`, `resolved_sha`.
   - Returns `{ ok: true, marker_cleared: true, baseline_updated: true, resolved_sha }`.
2. **Feedback-lifecycle integration in `state-tools.ts`:** the existing `haiku_feedback_update` handler (and `haiku_feedback_reject`) MUST call `clearMarkerForResolution` whenever a feedback item transitions to `closed` or `rejected`. Walk the `drift-markers.json` for any open marker with `linked_feedback_id === <feedback id>` and clear each. Specifically NOT triggered on `addressed` per AC-G5 / AC-SF3 / DATA-CONTRACTS.md §4.4 normative constraint — `addressed` is a mid-state and the marker stays open.
3. **Revisit-lifecycle integration in `orchestrator/revisit.ts`:** when a revisit completes (the targeted stage re-passes its review gate after the revisit cycle), walk `drift-markers.json` for any open marker with `linked_revisit_target_stage === <stage>` and `outcome === "trigger-revisit"`, then call `clearMarkerForResolution(intentDir, marker.path, "revisit-complete")` for each.
4. **Tool exposure decision (DATA-CONTRACTS.md §4.4):** `haiku_baseline_clear_marker` is **internal-only** in v1 — exposed as a function in the workflow engine but NOT registered in the MCP tool registry. The agent has no direct call path; only the feedback-lifecycle and revisit-lifecycle integration trigger it. This matches the §4.4 boundary note ("invoked by the workflow engine itself, not the agent").
5. **Atomicity:** the atomic write sets `cleared_at`, `resolved_sha`, AND the baseline entry in a single logical transaction. Use a tempfile-rename strategy: write the new `drift-markers.json` and `baseline.json` to tempfiles, then rename both into place with `Promise.all` so a crash mid-clear leaves either both old files or both new files (never one of each).
6. **Idempotency:** repeated calls for the same `(path, trigger)` combination after the marker is cleared return `{ marker_cleared: false, reason: "no_open_marker" }` without error. The feedback-lifecycle and revisit-lifecycle integrations rely on this — they call unconditionally on every transition without tracking whether the marker is still open.

Tests in `test/baseline-clear-marker.test.mjs`:

- `closed` and `rejected` feedback transitions clear the marker and update the baseline (covers Scenario Outline "surface-as-feedback baseline is updated when feedback reaches a terminal state").
- `addressed` feedback transition does NOT clear the marker (Scenario "feedback transitioning to addressed does NOT clear the pending-assessment marker").
- Revisit completion clears any markers linked to the revisited stage and updates the baseline (Scenario "SPA resolves pending-revisit state when the revisited stage re-passes its gate").
- `(surface-as-feedback, revisit-complete)` and `(trigger-revisit, feedback-closed)` return `trigger_outcome_mismatch`.
- Idempotent retry: calling `clearMarkerForResolution` twice for the same path returns `marker_cleared: false` on the second call.
- `pending_marker_cleared` event payload includes `resolved_sha` matching the on-disk SHA at clearance time.
- `Assessment.resulting_sha` stays `null` for the original non-terminal classification even after the marker is cleared (post-clearance SHA lives only on the marker and the event).
- Atomic-write behavior: a simulated crash between writing the marker tempfile and the baseline tempfile leaves both old files intact.

## Completion Criteria

- `packages/haiku/src/orchestrator/workflow/baseline-clear-marker.ts` exports `clearMarkerForResolution`.
- `packages/haiku/src/state-tools.ts` calls the helper from feedback-status transition paths (closed/rejected only).
- `packages/haiku/src/orchestrator/revisit.ts` calls the helper from revisit-completion paths.
- All scenarios in the related feature files are covered by passing tests.
- Biome, `tsc --noEmit`, and `bun run --cwd packages/haiku test` pass.
- No placeholders.
