---
title: haiku_baseline_init MCP tool (rollout bootstrap)
model: sonnet
depends_on:
  - unit-01-baseline-storage
inputs:
  - intent.md
  - knowledge/ARCHITECTURE.md
  - stages/design/artifacts/ARCHITECTURE.md
  - product/ACCEPTANCE-CRITERIA.md
  - product/DATA-CONTRACTS.md
outputs:
  - packages/haiku/src/tools/orchestrator/haiku_baseline_init.ts
  - packages/haiku/test/haiku-baseline-init.test.mjs
quality_gates:
  - name: biome
    command: >-
      bunx biome check
      packages/haiku/src/tools/orchestrator/haiku_baseline_init.ts
  - name: typecheck
    command: bun run --cwd packages/haiku typecheck
  - name: unit-tests
    command: bun run --cwd packages/haiku test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku/src/tools/orchestrator/haiku_baseline_init.ts
status: completed
bolt: 1
hat: reviewer
started_at: '2026-04-30T16:33:52Z'
hat_started_at: '2026-04-30T17:01:21Z'
iterations:
  - hat: planner
    started_at: '2026-04-30T16:33:52Z'
    completed_at: '2026-04-30T16:53:40Z'
    result: advance
  - hat: builder
    started_at: '2026-04-30T16:53:40Z'
    completed_at: '2026-04-30T17:01:21Z'
    result: advance
  - hat: reviewer
    started_at: '2026-04-30T17:01:21Z'
    completed_at: '2026-04-30T17:04:53Z'
    result: advance
completed_at: '2026-04-30T17:04:53Z'
---
# haiku_baseline_init MCP tool (rollout bootstrap)

## Scope

Implement the operator-callable MCP tool that explicitly establishes baselines for an intent — used by `haiku_repair`, the kill-switch re-arm flow per AC-G1-KS, and the manual rollout path. It is the explicit counterpart to the gate's first-tick auto-establish (AC-G8 / unit-04).

Deliverables per DATA-CONTRACTS.md §4.2:

1. **Zod input schema:** `intent_slug` (required), `mode` (required: `"establish-all"` | `"establish-paths"`), `paths` (string[], required when `mode === "establish-paths"`).
2. **Behavior — `establish-all`:** enumerate the tracked surface for every stage in the intent (using `enumerateTrackedSurface` from unit-01), hash every file, write `baseline.json` for each stage with `author_class: "agent"` and `acknowledged_via: "baseline-init"`. Files that already have a baseline entry whose SHA matches the on-disk content are left untouched (idempotent).
3. **Behavior — `establish-paths`:** validate every entry in `paths` falls inside an allowed tracked surface (same allow-list as `haiku_human_write`). For each, hash and upsert into the appropriate stage's baseline. Reject with `path_outside_tracked_surface` if any entry is workflow-managed, drift-subsystem-internal, or outside the intent.
4. **Response shape (DATA-CONTRACTS.md §4.2):**
```
{
  ok: true,
  intent_slug,
  baselines_created: <int>,
  baselines_skipped_existing: <int>,
  tracking_classes: { "stage-output": N, "knowledge": N, "unit-output": N, "intent-meta": N }
}
```
   Note: `unit-output` and `intent-meta` are always 0 in v1 — they exist for forward compatibility per AC-UO1/AC-UO2; the tool does not baseline `units/**` or `intent-meta` paths.
5. **Errors:** `intent_not_found` (404), `intent_not_active` (409 — archived intent), `tracked_surface_empty` (200 with warning, not an error — caller may want to know).
6. **Tool registration** in `packages/haiku/src/tools/orchestrator/index.ts`.
7. **Kill-switch re-arm path (AC-G1-KS):** the tool MUST be safe to call when `drift_detection: false`. It still establishes the baseline (because the operator may be staging the rollout), but emits a warning in the response noting the gate is currently disabled.

Tests in `test/haiku-baseline-init.test.mjs`:

- `establish-all` on a fresh intent writes a baseline for every stage with all tracked files; `tracking_classes` counts match the file inventory.
- `establish-all` on an intent with an existing baseline is idempotent — files whose SHA matches stay untouched, and `baselines_skipped_existing` reflects the count.
- `establish-paths` with a single path adds only that file's entry.
- `establish-paths` with a workflow-managed path returns `path_outside_tracked_surface` with `reason: "deny_list_match"` and writes nothing.
- `establish-paths` with a path outside the intent directory returns `path_outside_tracked_surface` with `reason: "path_escape"`.
- `intent_not_found` for an unknown slug.
- `intent_not_active` for an archived intent.
- `tracked_surface_empty` warning when an intent has no tracked files yet.
- Kill-switch interaction: tool succeeds with a warning when `drift_detection: false`.

## Completion Criteria

- `packages/haiku/src/tools/orchestrator/haiku_baseline_init.ts` exports the tool definition and handler.
- Tool registered in `index.ts`.
- All tests pass under `bun run --cwd packages/haiku test`.
- Biome + tsc pass.
- No placeholders.
