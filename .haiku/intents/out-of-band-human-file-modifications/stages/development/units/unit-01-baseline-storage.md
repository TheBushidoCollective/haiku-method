---
title: Baseline storage layer (drift-baseline.ts)
model: opus
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - knowledge/ARCHITECTURE.md
  - stages/design/artifacts/ARCHITECTURE.md
  - product/DATA-CONTRACTS.md
  - product/ACCEPTANCE-CRITERIA.md
outputs:
  - packages/haiku/src/orchestrator/workflow/drift-baseline.ts
  - packages/haiku/test/drift-baseline.test.mjs
quality_gates:
  - name: biome
    command: >-
      bunx biome check
      packages/haiku/src/orchestrator/workflow/drift-baseline.ts
  - name: typecheck
    command: bun run --cwd packages/haiku typecheck
  - name: unit-tests
    command: bun run --cwd packages/haiku test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku/src/orchestrator/workflow/drift-baseline.ts
status: completed
bolt: 4
hat: reviewer
started_at: '2026-04-30T12:40:45Z'
hat_started_at: '2026-04-30T13:21:56Z'
iterations:
  - hat: planner
    started_at: '2026-04-30T12:40:45Z'
    completed_at: '2026-04-30T12:48:59Z'
    result: advance
  - hat: builder
    started_at: '2026-04-30T12:48:59Z'
    completed_at: '2026-04-30T12:59:57Z'
    result: reject
    reason: 'auto-reject: quality_gate_failed (typecheck)'
  - hat: builder
    started_at: '2026-04-30T12:59:57Z'
    completed_at: '2026-04-30T13:02:56Z'
    result: reject
    reason: 'auto-reject: quality_gate_failed (typecheck, unit-tests)'
  - hat: builder
    started_at: '2026-04-30T13:02:56Z'
    completed_at: '2026-04-30T13:11:10Z'
    result: advance
  - hat: reviewer
    started_at: '2026-04-30T13:11:10Z'
    completed_at: '2026-04-30T13:15:16Z'
    result: reject
    reason: >-
      Two defects: (1) enumerateTrackedSurface produces incorrect absPath for
      files in stages/{stage}/outputs/ — canonicalisePath rewrites the relative
      path to artifacts/ but then join(intentDir, canonical) points to the
      non-existent artifacts/ location rather than the actual outputs/ file on
      disk; confirmed empirically (absPath exists on disk: false). Any
      drift-gate SHA computation via absPath will fail for outputs/-alias files.
      (2) writeBaseline does not sort JSON keys — spec requires "sorted keys"
      but JSON.stringify preserves insertion order. Quality issues: dead `_dir`
      variable on line 167 (computed, never used) and misleading atomicity
      comment (tempfile goes to tmpdir(), not same dir as target).
  - hat: builder
    started_at: '2026-04-30T13:15:16Z'
    completed_at: '2026-04-30T13:21:56Z'
    result: advance
  - hat: reviewer
    started_at: '2026-04-30T13:21:56Z'
    completed_at: '2026-04-30T16:31:22Z'
    result: advance
model_original: sonnet
completed_at: '2026-04-30T16:31:22Z'
---
# Baseline storage layer (drift-baseline.ts)

## Scope

Implement the per-stage SHA baseline read/write helpers and tracked-surface enumeration that every other piece of the drift subsystem depends on. This unit owns one file (`drift-baseline.ts`) plus its tests; nothing else in the codebase imports baseline JSON directly.

Deliverables:

1. `Baseline` and `BaselineEntry` TypeScript types matching DATA-CONTRACTS.md §2.1 (`path`, `sha256`, `bytes`, `mtime_ns`, `is_binary`, `author_class`, `acknowledged_at`, `acknowledged_via`, `stage`, `tracking_class`).
2. `readBaseline(intentDir, stage)` — parses `stages/{stage}/baseline.json`. Returns `{ entries: Map<path, BaselineEntry> }`. Returns `null` when the file does not exist (signals establish-mode to caller). Throws a typed `BaselineCorruptError` when the file exists but cannot be parsed or fails schema validation, so the gate can short-circuit per AC-EE4 / ARCHITECTURE.md §8.2.
3. `writeBaseline(intentDir, stage, baseline)` — serialises to canonical JSON (sorted keys, 2-space indent, trailing newline) and atomically renames a tempfile into place so a concurrent reader never observes a partial write.
4. `computeFileSha256(absolutePath)` — streams the file through `crypto.createHash('sha256')` (no full-buffer load) and returns lowercase hex. Used by every caller that has to hash a tracked file.
5. `isBinary(absolutePath)` — reads the first 8192 bytes and returns `true` when any null byte is found OR when the bytes fail UTF-8 decoding (matches DATA-CONTRACTS.md §2.1 / TRACKED-SURFACE-BOUNDARY.md heuristic).
6. `enumerateTrackedSurface(intentDir, stage, studioConfig)` — returns a list of `{ pathRel, absPath, trackingClass, stageOwner }` records covering the union from ARCHITECTURE.md §3.3:
   - `stages/{stage}/artifacts/**` (canonical) and `stages/{stage}/outputs/**` (alias — both keyed under canonical `artifacts/` per AC-ALIAS1/2).
   - `stages/{stage}/knowledge/**` and `stages/{stage}/discovery/**` (tracking_class `knowledge`).
   - intent-scope `knowledge/**` (stage_owner `null`, tracking_class `knowledge`).
   Excludes the workflow-managed paths (`units/*.md`, `feedback/*.md`, `intent.md`, `state.json`) per AC-G7 and the drift-subsystem state files (`baseline.json`, `drift-markers.json`, `write-audit.jsonl`, `drift-assessments/*.json`) per ARCHITECTURE.md §3.1. Excludes editor temp files matching `^\.#`, `~$`, `\.swp$`, `\.swo$`, `^4913$` per AC-FS3.
7. `canonicalisePath(pathRel)` — rewrites any `stages/{stage}/outputs/...` segment to `stages/{stage}/artifacts/...` so baseline keys are always canonical (AC-ALIAS2).
8. `updateBaselineEntry(baseline, entry)` — pure helper that returns a new map with the entry inserted/updated; never mutates inputs.

Test coverage in `test/drift-baseline.test.mjs` (running under the existing `node test/run-all.mjs` runner — wire it into `run-all.mjs` if not already auto-discovered):

- Round-trip: write → read returns identical entry set.
- Missing file returns `null` (establish-mode signal).
- Corrupt JSON throws `BaselineCorruptError` carrying the stage name.
- Schema violation (missing `sha256`, invalid `author_class`) throws `BaselineCorruptError`.
- `computeFileSha256` matches a known SHA for a fixture file.
- `isBinary` returns true for a PNG fixture, false for a markdown fixture.
- `enumerateTrackedSurface` includes `artifacts/`, `knowledge/`, `discovery/`, intent-scope `knowledge/`; excludes `units/`, `feedback/`, `intent.md`, `state.json`, `baseline.json`, `drift-markers.json`, `write-audit.jsonl`, and the editor-temp patterns.
- `canonicalisePath` rewrites `outputs/` → `artifacts/` and leaves canonical paths untouched.
- Atomic write: simulating a crash mid-write (write tempfile, do not rename) leaves the prior `baseline.json` intact.

## Completion Criteria

- `packages/haiku/src/orchestrator/workflow/drift-baseline.ts` exists and exports the eight functions/types named above.
- All tests in `packages/haiku/test/drift-baseline.test.mjs` pass under the project's standard test runner (the unit-tests gate runs the full `bun run --cwd packages/haiku test`).
- No new third-party dependency is added — implementation uses only `node:crypto`, `node:fs/promises`, `node:path`, and the existing `yaml`/`zod` already present in `packages/haiku`.
- Biome and `tsc --noEmit` both pass.
- No `TBD`, `TODO`, `...` placeholders remain in the source file (gated by the `no-placeholders` quality gate).
