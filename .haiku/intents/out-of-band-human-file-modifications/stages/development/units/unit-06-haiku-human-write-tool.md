---
title: haiku_human_write MCP tool
model: sonnet
depends_on:
  - unit-01-baseline-storage
  - unit-03-write-audit-log
inputs:
  - intent.md
  - stages/design/artifacts/MCP-TOOL-CONTRACT.md
  - stages/design/artifacts/ARCHITECTURE.md
  - product/ACCEPTANCE-CRITERIA.md
  - product/DATA-CONTRACTS.md
  - features/agent-writes-on-behalf-of-human.feature
outputs:
  - packages/haiku/src/tools/orchestrator/haiku_human_write.ts
  - packages/haiku/src/tools/orchestrator/index.ts
  - packages/haiku/test/haiku-human-write.test.mjs
quality_gates:
  - name: biome
    command: >-
      bunx biome check
      packages/haiku/src/tools/orchestrator/haiku_human_write.ts
  - name: typecheck
    command: bun run --cwd packages/haiku typecheck
  - name: unit-tests
    command: bun run --cwd packages/haiku test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku/src/tools/orchestrator/haiku_human_write.ts
status: completed
bolt: 1
hat: reviewer
started_at: '2026-04-30T17:06:05Z'
hat_started_at: '2026-04-30T17:26:52Z'
iterations:
  - hat: planner
    started_at: '2026-04-30T17:06:05Z'
    completed_at: '2026-04-30T17:19:24Z'
    result: advance
  - hat: builder
    started_at: '2026-04-30T17:19:24Z'
    completed_at: '2026-04-30T17:26:52Z'
    result: advance
  - hat: reviewer
    started_at: '2026-04-30T17:26:52Z'
    completed_at: '2026-04-30T20:37:43Z'
    result: advance
completed_at: '2026-04-30T20:37:43Z'
---
# haiku_human_write MCP tool

## Scope

Implement the conversational human-attributed write MCP tool exactly per `stages/design/artifacts/MCP-TOOL-CONTRACT.md`. This is the agent-callable path for "hey claude, write this file for me" — the tool writes the file, stamps the action log, appends the audit log, and deliberately does NOT update `baseline.json` so the next tick's drift gate emits a normal `manual_change_assessment` (per ARCHITECTURE.md §6.2 / §6.3 and AC-AB2).

Deliverables:

1. **Zod input schema** matching MCP-TOOL-CONTRACT.md §3:
   - Required: `path` (string, intent-relative or absolute-resolves-into-intent), `content` (string).
   - Optional: `content_encoding` (`"utf-8"` default | `"base64"`), `human_author_id` (string), `rationale` (string), `overwrite` (boolean, default `true`), `create_dirs` (boolean, default `true`).
2. **Path validation** per MCP-TOOL-CONTRACT.md §5:
   - Resolve absolute → intent-relative (canonical form).
   - Reject paths escaping the intent directory (`..` segments, symlinks resolving outside, absolute paths outside the intent root) with `path_outside_tracked_surface` + `reason: "path_escape"`.
   - Apply the deny-list: `units/*.md`, `feedback/*.md`, `intent.md`, `state.json`, `baseline.json`, `drift-markers.json`, `write-audit.jsonl`, `drift-assessments/*` — all return `path_outside_tracked_surface` + `reason: "deny_list_match"` + `deny_rule` field naming the matched rule.
   - Apply the allow-list: `knowledge/**`, `stages/{stage}/knowledge/**`, `stages/{stage}/discovery/**`, `stages/{stage}/outputs/**` (alias canonicalised to `artifacts/`), `stages/{stage}/artifacts/**`. Reject anything else with `reason: "no_allow_match"`.
   - Validate that any `{stage}` segment maps to an existing stage in the intent's studio config; reject with `reason: "invalid_stage"` otherwise.
3. **Rationale enforcement (AC-TA1 / MCP-TOOL-CONTRACT.md §7.2):** when plugin settings include `human_write_require_rationale: true` and `rationale` is empty, return `rationale_required` error. Default plugin setting is `false`.
4. **Empty content rejection (Scenario "haiku_human_write refuses zero-byte content"):** when `content === ""` after decoding, return an error indicating empty content not permitted. No file is written.
5. **Atomic disk write (MCP-TOOL-CONTRACT.md §6.1):** decode content per `content_encoding`. Write to a temp file in the same directory and `rename(2)` into place — never expose a partially-written file to a concurrent drift-gate read. When the destination already exists and `overwrite: false`, return `path_already_exists` with `existing_sha`. When `create_dirs: false` and the parent directory is missing, return `parent_dir_missing` with `missing_dir`.
6. **Action-log + audit-log append (MCP-TOOL-CONTRACT.md §6.2 / §8):** after the rename succeeds, call `appendActionLogEntry(intentDir, tickCounter, { entry_type: 'human_write', path, sha, author_class: 'human-via-mcp', timestamp, human_author_id, entry_id })` from unit-03. Then call `appendWriteAudit(intentDir, record)` building the audit record with all 12 fields including `user_instruction_excerpt` (truncated to 200 chars by `truncateInstruction` from unit-03). The audit append's success is reflected in the response's `audit_log_appended` boolean — failure does NOT abort the parent write per MCP-TOOL-CONTRACT.md §4.1.
7. **Baseline non-update (AC-AB2 / MCP-TOOL-CONTRACT.md §6.3):** the tool MUST NOT call `writeBaseline`. The next pre-tick drift gate observes the SHA divergence and dispatches `manual_change_assessment` exactly the way it would for any other tracked-surface change.
8. **Kill-switch interaction (ARCHITECTURE.md §8.5 / `drift_detection: false`):** when the kill-switch is set, the tool still writes the file and stamps the action log, but skips the audit-log append (the audit log is part of the drift-detection feature; with the feature off, the audit gap is the explicit accepted trade-off documented in §8.5). The response's `audit_log_appended: false` carries the `reason: "drift_detection_disabled"` so a security reviewer can see why the entry is missing.
9. **Response shape** matching MCP-TOOL-CONTRACT.md §4.1: `ok`, `path` (canonical), `sha`, `author_class: "human-via-mcp"`, `timestamp`, `human_author_id`, `dirs_created`, `action_log_entry_id`, `audit_log_appended`.
10. **Tool registration** in `packages/haiku/src/tools/orchestrator/index.ts` (extending the existing tool registry) so `haiku_human_write` is exposed via the MCP server.
11. **Workflow-fields hook compatibility:** verify that the existing `guard-workflow-fields` PreToolUse hook does NOT block this tool (the tool name is on the workflow-managed-tool list, not the deny list). Add a unit test that exercises the hook against the deny-listed paths to confirm the same `path_outside_tracked_surface` is returned by the tool when the hook does not catch it (defence in depth — both layers reject the same paths).

Tests in `test/haiku-human-write.test.mjs` cover every scenario in `features/agent-writes-on-behalf-of-human.feature`:

- Happy path "User instructs the agent to save a file as human-attributed".
- Audit log records all 12 fields including `user_instruction_excerpt`.
- Failed writes (deny-list, escape path) do NOT append to the audit log.
- Refusals: workflow-managed path (`stages/design/state.json`), `write-audit.jsonl` itself, `../../../etc/passwd`, empty content.
- Trust+Audit: tool completes without confirmation prompt in both `interactive` and `autopilot` modes.
- Mode equivalence: identical behavior in interactive vs. autopilot.
- Path normalisation: absolute path resolving inside the intent directory works; absolute path escaping the intent directory is rejected.
- Each `human_author_id`/`rationale`/`user_instruction_excerpt` carry through to the audit log entry literally.
- Kill-switch interaction: tool still writes, action log still stamped, audit log skipped with `audit_log_appended: false` + `reason: "drift_detection_disabled"`.

## Completion Criteria

- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts` exports the tool definition and handler.
- The tool is registered in `packages/haiku/src/tools/orchestrator/index.ts` and visible to MCP `tools/list`.
- Every scenario in `features/agent-writes-on-behalf-of-human.feature` is covered by a passing test in `test/haiku-human-write.test.mjs`.
- Biome, `tsc --noEmit`, and `bun run --cwd packages/haiku test` pass.
- No placeholders.
