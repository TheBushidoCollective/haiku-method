---
title: Write-audit JSONL log + per-tick action log
model: sonnet
depends_on:
  - unit-01-baseline-storage
inputs:
  - intent.md
  - knowledge/ARCHITECTURE.md
  - stages/design/artifacts/ARCHITECTURE.md
  - stages/design/artifacts/MCP-TOOL-CONTRACT.md
  - product/ACCEPTANCE-CRITERIA.md
  - product/DATA-CONTRACTS.md
outputs:
  - packages/haiku/src/orchestrator/workflow/write-audit.ts
  - packages/haiku/src/orchestrator/workflow/action-log.ts
  - packages/haiku/test/write-audit.test.mjs
quality_gates:
  - name: biome
    command: >-
      bunx biome check packages/haiku/src/orchestrator/workflow/write-audit.ts
      packages/haiku/src/orchestrator/workflow/action-log.ts
  - name: typecheck
    command: bun run --cwd packages/haiku typecheck
  - name: unit-tests
    command: bun run --cwd packages/haiku test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku/src/orchestrator/workflow/write-audit.ts
      packages/haiku/src/orchestrator/workflow/action-log.ts
status: completed
bolt: 1
hat: reviewer
started_at: '2026-04-30T16:33:47Z'
hat_started_at: '2026-04-30T16:45:46Z'
iterations:
  - hat: planner
    started_at: '2026-04-30T16:33:47Z'
    completed_at: '2026-04-30T16:40:10Z'
    result: advance
  - hat: builder
    started_at: '2026-04-30T16:40:10Z'
    completed_at: '2026-04-30T16:45:46Z'
    result: advance
  - hat: reviewer
    started_at: '2026-04-30T16:45:46Z'
    completed_at: '2026-04-30T16:48:28Z'
    result: advance
completed_at: '2026-04-30T16:48:28Z'
---
# Write-audit JSONL log + per-tick action log

## Scope

Implement the two append-only logs that record human-attributed write events: `write-audit.jsonl` (durable per-intent audit trail per MCP-TOOL-CONTRACT.md §8) and the per-tick action log that the drift gate consults to distinguish `human-via-mcp` from `human-implicit` writes (per ARCHITECTURE.md §6.1, §7.3).

Deliverables:

1. `WriteAuditRecord` and `ActionLogEntry` TypeScript types matching MCP-TOOL-CONTRACT.md §8.1 and the contract in ARCHITECTURE.md §6.2:
   - `WriteAuditRecord` fields: `timestamp`, `entry_id`, `path`, `sha`, `author_class` (always `"human-via-mcp"`), `human_author_id|null`, `rationale|null`, `user_instruction_excerpt|null` (truncated to 200 chars), `tick_counter`, `session_id|null`, `overwrite`, `dirs_created` (string[]), `audit_log_appended` (always `true` in stored records).
   - `ActionLogEntry` fields: `entry_type` (`"human_write"` | `"agent_write"`), `path`, `sha`, `author_class` (`"human-via-mcp"` | `"agent"`), `timestamp`, `human_author_id|null`, `entry_id`, `tick_counter`.
2. `appendWriteAudit(intentDir, record)` — opens `write-audit.jsonl` in `O_APPEND` mode, writes `JSON.stringify(record) + "\n"` in a single `write()` call, and `fsync`s before returning. Concurrency-safe under POSIX append semantics — the file system guarantees atomic appends ≤ `PIPE_BUF` (4 KiB on most platforms; v1 audit records fit comfortably). Returns `{ ok: true }` on success and `{ ok: false, reason }` on failure (caller surfaces via the `audit_log_appended` field on the tool response — failures do NOT abort the parent write per MCP-TOOL-CONTRACT.md §4.1).
3. `nextEntryId(tickCounter, sequenceNumber)` — formats as `HWM-{tickCounter}-{NN}` per MCP-TOOL-CONTRACT.md §4.1. The caller is responsible for tracking the per-tick sequence; this helper just formats the string with zero-padding (NN ≥ 2 digits).
4. `appendActionLogEntry(intentDir, tickCounter, entry)` — writes to `stages/.../action-log/tick-{NN}.jsonl` (or a single intent-scope action log; the contract is per-tick scoped, so use `.haiku/intents/{slug}/action-log.jsonl` with the entry carrying its own `tick_counter`). Same atomic-append semantics as the audit log.
5. `readActionLogForTick(intentDir, tickCounter)` — returns the list of action-log entries for a given tick. The drift gate calls this to look up whether a write came through `haiku_human_write` (so the emitted DriftFinding carries `author_class: "human-via-mcp"` instead of the inferred `"human-implicit"`).
6. `findActionLogEntryForPath(entries, pathRel)` — returns the most recent entry for a given file path, or `null`. Used by the gate when classifying author class.
7. `truncateInstruction(text, max=200)` — pure helper that truncates user-instruction excerpts to 200 chars, replacing tail with `...` when truncated.

Tests in `test/write-audit.test.mjs`:

- Append-only invariant: write three records, read them back in order; rewrite the file is impossible through the public API surface (no exported truncate/clear function).
- Each record is one complete JSON object on its own line (round-trip via `JSON.parse` after `split('\n')`).
- Failed disk write surfaces `{ ok: false, reason }` instead of throwing.
- Concurrent appends from two simulated writers (bun async tasks) produce two distinct lines (no interleaved bytes).
- `nextEntryId(42, 1)` returns `"HWM-42-01"`; `nextEntryId(42, 12)` returns `"HWM-42-12"`.
- `appendActionLogEntry` round-trips through `readActionLogForTick`.
- `findActionLogEntryForPath` returns the newest entry when multiple entries reference the same path.
- `truncateInstruction("a".repeat(250))` returns 203 chars (200 + `...`).
- Audit-log append never fails the caller's parent write — even when the audit-log filesystem is read-only, `appendWriteAudit` returns `{ ok: false, reason }` and the test verifies the parent caller can still continue.

## Completion Criteria

- `packages/haiku/src/orchestrator/workflow/write-audit.ts` and `action-log.ts` export the seven helpers / types named above.
- All tests in `packages/haiku/test/write-audit.test.mjs` pass under `bun run --cwd packages/haiku test`.
- Biome and `tsc --noEmit` pass.
- No placeholders.
