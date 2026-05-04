---
title: Pending-assessment marker store (drift-markers.ts)
model: sonnet
depends_on:
  - unit-01-baseline-storage
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - knowledge/ARCHITECTURE.md
  - stages/design/artifacts/ARCHITECTURE.md
  - product/DATA-CONTRACTS.md
  - product/ACCEPTANCE-CRITERIA.md
outputs:
  - packages/haiku/src/orchestrator/workflow/drift-markers.ts
  - packages/haiku/test/drift-markers.test.mjs
quality_gates:
  - name: biome
    command: bunx biome check packages/haiku/src/orchestrator/workflow/drift-markers.ts
  - name: typecheck
    command: bun run --cwd packages/haiku typecheck
  - name: unit-tests
    command: bun run --cwd packages/haiku test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku/src/orchestrator/workflow/drift-markers.ts
status: completed
bolt: 1
hat: reviewer
started_at: '2026-04-30T16:33:55Z'
hat_started_at: '2026-04-30T16:50:27Z'
iterations:
  - hat: planner
    started_at: '2026-04-30T16:33:55Z'
    completed_at: '2026-04-30T16:46:35Z'
    result: advance
  - hat: builder
    started_at: '2026-04-30T16:46:35Z'
    completed_at: '2026-04-30T16:50:27Z'
    result: advance
  - hat: reviewer
    started_at: '2026-04-30T16:50:27Z'
    completed_at: '2026-04-30T16:56:05Z'
    result: advance
completed_at: '2026-04-30T16:56:05Z'
---
# Pending-assessment marker store (drift-markers.ts)

## Scope

Implement the intent-scoped `drift-markers.json` store that suppresses re-detection of files with open non-terminal assessments and that AC-G5 / AC-SF3 / AC-TR2 reference. This unit owns `drift-markers.ts` plus its tests; nothing else writes the marker file directly.

Deliverables:

1. `PendingMarker` type matching DATA-CONTRACTS.md §2.2 — fields: `path`, `created_at`, `created_by_assessment_id`, `outcome` (`surface-as-feedback` | `trigger-revisit`), `linked_feedback_id` (string|null), `linked_revisit_target_stage` (string|null), `cleared_at` (string|null), `resolved_sha` (string|null).
2. `readMarkers(intentDir)` — parses `drift-markers.json` at the intent root. Returns an empty `{ markers: [] }` when the file is missing (graceful degraded behavior per AC-EE / ARCHITECTURE.md §8.4 — a missing file is not corruption). Logs a non-fatal warning and returns empty when the file exists but cannot be parsed (degraded operation; do NOT throw — the marker store is a suppression optimisation per ARCHITECTURE.md §8.4).
3. `writeMarkers(intentDir, markers)` — atomic-rename write, canonical JSON formatting identical to `writeBaseline`.
4. `appendMarker(intentDir, marker)` — read-append-write. Refuses to insert when `linked_feedback_id` and `linked_revisit_target_stage` are both non-null OR both null (mutual-exclusion invariant from DATA-CONTRACTS.md §2.2). Throws `MarkerInvariantError` on violation.
5. `findOpenMarker(markers, pathRel)` — returns the newest open marker (`cleared_at === null`) for a path, or `null`. The gate uses this to decide suppression.
6. `clearMarker(intentDir, pathRel, resolvedSha, trigger)` — sets `cleared_at` (current ISO-8601 UTC) and `resolved_sha` together in a single atomic write. Validates the `(outcome, trigger)` legality matrix from DATA-CONTRACTS.md §4.4: `surface-as-feedback` accepts `feedback-closed` and `feedback-rejected`; `trigger-revisit` accepts only `revisit-complete`. Returns `{ cleared: true, marker }` on success and `{ cleared: false, reason: 'no_open_marker' }` when no open marker exists for the path (idempotent retry). Throws `TriggerOutcomeMismatchError` when the trigger does not match the marker's outcome.
7. `isStaleMarker(marker, currentSha)` — returns true when `currentSha !== marker.baseline_sha_at_creation`. The gate uses this to detect double-edits per AC-EE6 / ARCHITECTURE.md §5.3. Note: the marker's `baseline_sha_at_creation` is stored in addition to the DATA-CONTRACTS.md §2.2 fields — emit it as a literal-string-typed extra field on `PendingMarker` for v1 (DATA-CONTRACTS.md is the canonical schema and ARCHITECTURE.md §5.2 names this field; both must reconcile to the same on-disk shape).
8. `removeMarker(intentDir, pathRel)` — deletes any open marker for a path. Used by the gate when it detects a stale marker per `isStaleMarker`.

Tests in `test/drift-markers.test.mjs`:

- Round-trip read/write.
- Missing file returns empty array (no error).
- Corrupted file returns empty array AND emits a warning to a captured logger (no throw).
- `appendMarker` rejects records that violate the FB/revisit mutual-exclusion invariant.
- `findOpenMarker` returns the newest open marker when multiple closed markers exist for the same path.
- `clearMarker` sets `cleared_at` and `resolved_sha` together; reads back identical values.
- `clearMarker` rejects `(surface-as-feedback, revisit-complete)` and `(trigger-revisit, feedback-closed)` with `TriggerOutcomeMismatchError`.
- `clearMarker` returns `{ cleared: false, reason: 'no_open_marker' }` when no open marker exists (idempotent retry safe).
- `isStaleMarker` returns true on double-edit, false when SHA matches creation-time SHA.

## Completion Criteria

- `packages/haiku/src/orchestrator/workflow/drift-markers.ts` exports the seven functions/types named above.
- All tests in `packages/haiku/test/drift-markers.test.mjs` pass under `bun run --cwd packages/haiku test`.
- No new third-party dependency.
- Biome and `tsc --noEmit` pass.
- No placeholders.
