---
title: Pre-tick drift-detection gate + run-tick integration
model: opus
depends_on:
  - unit-01-baseline-storage
  - unit-02-drift-markers-storage
  - unit-03-write-audit-log
inputs:
  - intent.md
  - knowledge/ARCHITECTURE.md
  - stages/design/artifacts/ARCHITECTURE.md
  - product/ACCEPTANCE-CRITERIA.md
  - product/DATA-CONTRACTS.md
  - features/silent-filesystem-drop-detection.feature
outputs:
  - packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
  - packages/haiku/src/orchestrator/workflow/run-tick.ts
  - packages/haiku/test/drift-detection-gate.test.mjs
quality_gates:
  - name: biome
    command: >-
      bunx biome check
      packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
      packages/haiku/src/orchestrator/workflow/run-tick.ts
  - name: typecheck
    command: bun run --cwd packages/haiku typecheck
  - name: unit-tests
    command: bun run --cwd packages/haiku test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
status: completed
bolt: 2
hat: builder
started_at: '2026-04-30T17:07:13Z'
hat_started_at: '2026-04-30T17:43:42Z'
iterations:
  - hat: planner
    started_at: '2026-04-30T17:07:13Z'
    completed_at: '2026-04-30T17:30:14Z'
    result: advance
  - hat: builder
    started_at: '2026-04-30T17:30:14Z'
    completed_at: '2026-04-30T17:39:44Z'
    result: advance
  - hat: reviewer
    started_at: '2026-04-30T17:39:44Z'
    completed_at: '2026-04-30T17:43:42Z'
    result: reject
    reason: >-
      Diff generation for modified text files is broken: buildUnifiedDiff passes
      a SHA-256 content hash to `git cat-file blob`, but git objects use SHA-1.
      This means diff_unified will always be null for modified files — git will
      never find the blob. The spec allows null as a fallback but AC-T1 and the
      feature scenario 2 ("diff_unified field shows only the lines the PO
      changed") require a real diff. Additionally, the test for Scenario 2 does
      not assert diff_unified !== null, so the test passes even though diff
      generation fails. Two additional gaps: (1) no test exercises the full
      runWorkflowTick → drift-detection gate → manual_change_assessment
      short-circuit path; (2) the kill-switch test uses real disk I/O rather
      than mocking fs.readFile as the spec prescribes. The diff defect is the
      blocker.
  - hat: builder
    started_at: '2026-04-30T17:43:42Z'
    completed_at: '2026-04-30T18:01:06Z'
    result: advance
completed_at: '2026-04-30T18:01:06Z'
---
# Pre-tick drift-detection gate + run-tick integration

## Scope

Implement the pre-tick gate that detects out-of-band human writes on every `haiku_run_next` tick and wire it into the existing pre-tick gate chain in `run-tick.ts`. This is the load-bearing entry point — every other piece (the action handler, the SPA banner, the assessment record) is downstream of the events this gate emits.

Deliverables:

1. `runDriftDetectionGate(ctx)` in `drift-detection-gate.ts` — pure function that takes `{ intentDir, intentSlug, activeStage, studioConfig, settings, tickCounter }` and returns `{ findings: DriftFinding[], baselineEstablished: boolean, action: 'manual_change_assessment' | null, error?: 'baseline_corrupt' }`.
2. **Kill-switch (AC-G1-KS):** when `settings.drift_detection === false` the gate returns `{ findings: [], baselineEstablished: false, action: null }` without touching disk — no SHA computation, no `baseline.json` read, no `drift-markers.json` read, no enumeration. Verified by a test that mocks `fs.readFile` and asserts zero reads.
3. **Establish-mode (AC-G8 / ARCHITECTURE.md §3.4):** when `readBaseline(...)` returns `null`, the gate enumerates the tracked surface, hashes every file, writes `baseline.json` with `author_class: "agent"` and `acknowledged_via: "baseline-init"`, and returns `{ baselineEstablished: true, findings: [], action: null }`. The first-tick "establish, don't fire" rule.
4. **Steady-state scan:** for each file in the tracked surface plus each baseline entry whose path is no longer present:
   - Compute current SHA via `computeFileSha256` from unit-01.
   - Look up open marker via `findOpenMarker` from unit-02; if present and `currentSha === marker.baseline_sha_at_creation`, suppress the file (no event emitted, AC-SF2).
   - If the marker is stale (`isStaleMarker` returns true), call `removeMarker` and proceed to emit a fresh DriftFinding (AC-EE6).
   - When current SHA matches baseline SHA: no event.
   - When current SHA differs and no open marker: emit `{ change_kind: 'modified', ... }`.
   - When file is in baseline but missing from disk: emit `{ change_kind: 'deleted', after_sha256: null, diff_unified: null }` (AC-EE2 / Scenario "Tracked file is deleted").
   - When file is on disk but absent from baseline: emit `{ change_kind: 'new-file-detected', before_sha256: null }` (AC-FS2). For text files under 256 KB include the full content as a `+++`-only diff; otherwise `diff_unified: null`.
5. **DriftFinding shape (DATA-CONTRACTS.md §3.1):** all fields populated; cross-field invariants validated before emission (added ⇒ before_sha256/before_bytes null; deleted ⇒ after_sha256/after_bytes/diff_unified null; modified ⇒ all four non-null and SHAs differ; binary ⇒ diff_unified null).
6. **Author-class attribution:** for each finding, look up `findActionLogEntryForPath` from unit-03. If a `human_write` action-log entry exists for the path within the current tick window, set `author_class: 'human-via-mcp'`. Otherwise emit with the baseline's `author_class` and let the assessment handler downgrade to `human-implicit` per ARCHITECTURE.md §6.2 inference rule.
7. **Diff payload:** for text files, generate a unified diff with three lines of context comparing the cached baseline content (held in a sidecar, or re-derived via git blob lookup if available — when no prior content can be retrieved, emit `diff_unified: null` with a flag in the rationale). Truncate to 200 lines per ARCHITECTURE.md §3.6 with a trailing `... (truncated, full diff at <path>)` line.
8. **Out-of-sync heuristic (ARCHITECTURE.md §8.3):** when the count of drift events exceeds 50 % of the tracked surface in a single tick, replace the findings list with a single synthetic `{ change_kind: 'modified', file_path: '<stage>', is_baseline_oom: true }` payload so the assessment handler can default to `trigger-revisit`.
9. **Corrupt-baseline path (AC-EE4):** when `readBaseline` throws `BaselineCorruptError`, the gate returns `{ findings: [], baselineEstablished: false, action: null, error: 'baseline_corrupt' }` so `run-tick.ts` can surface the error to the agent and halt before per-state dispatch.
10. **`run-tick.ts` integration:** insert `runDriftDetectionGate` immediately after the existing feedback-triage gate and before per-state dispatch — preserving the contract `tamper → feedback-triage → drift-detection → per-state dispatch` (AC-G13). When the gate returns `findings.length > 0`, build the `manual_change_assessment` action via the unit-05 handler and short-circuit per-state dispatch. When it returns `error: 'baseline_corrupt'`, return an `error` action to the agent with the message specified in AC-EE4 and ARCHITECTURE.md §8.2.

Tests in `test/drift-detection-gate.test.mjs` cover every Background scenario from `features/silent-filesystem-drop-detection.feature`: designer replacement, PO edit, knowledge drop, alias `outputs/` → `artifacts/`, multiple-files-in-one-tick, zero changes, mid-bolt isolation, first-tick establish, kill-switch off, kill-switch re-enable, editor temp files, deletions, binary, marker suppression (matching SHA), marker stale (double-edit), marker terminal-state cleared, baseline corrupt halt, files outside tracked surface, files inside `units/` ignored.

## Completion Criteria

- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` exports `runDriftDetectionGate` and the typed result.
- `packages/haiku/src/orchestrator/workflow/run-tick.ts` invokes the gate in the documented chain position and short-circuits to `manual_change_assessment` when findings are present.
- All scenarios in `features/silent-filesystem-drop-detection.feature` are covered by passing assertions in `test/drift-detection-gate.test.mjs` (one test case per scenario, with `Scenario Outline` rows expanded to one test each).
- Existing tick tests (orchestrator, server-tools) continue to pass — no regressions.
- Biome, `tsc --noEmit`, and `bun run --cwd packages/haiku test` all pass.
- No placeholders.
