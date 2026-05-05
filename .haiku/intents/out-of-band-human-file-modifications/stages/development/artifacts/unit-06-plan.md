# Implementation Plan — unit-06-haiku-human-write-tool

## Objective

Implement the `haiku_human_write` MCP tool per `MCP-TOOL-CONTRACT.md`, wire it
into the existing tool registry, and cover every scenario in
`features/agent-writes-on-behalf-of-human.feature` with passing tests.

---

## Context from Upstream Analysis

### Existing infrastructure (all already implemented — do not re-implement)

| Module | What it provides |
|---|---|
| `orchestrator/workflow/drift-baseline.ts` | `canonicalisePath`, `computeFileSha256`, `isBinary`, `writeBaseline`, `readBaseline` — all needed by the tool |
| `orchestrator/workflow/write-audit.ts` | `WriteAuditRecord`, `appendWriteAudit`, `nextEntryId`, `truncateInstruction`, `writeAuditPath` |
| `orchestrator/workflow/action-log.ts` | `ActionLogEntry`, `appendActionLogEntry` |
| `tools/define.ts` | `defineTool`, `validateSlugArgs` |
| `tools/orchestrator/_text.ts` | `text()` helper |
| `state/shared.ts` | `findHaikuRoot`, `setHaikuRootForTests` |
| `tools/orchestrator/haiku_baseline_init.ts` | Pattern for settings-file reading (`isDriftDetectionDisabled`) — copy the gray-matter approach |
| `tools/orchestrator/index.ts` | Registry — add `haiku_human_write` here |

### Allow-list (writable paths per MCP-TOOL-CONTRACT.md §5.1)

- `knowledge/**`
- `stages/{stage}/knowledge/**`
- `stages/{stage}/discovery/**`
- `stages/{stage}/outputs/**` → canonicalised to `stages/{stage}/artifacts/**`
- `stages/{stage}/artifacts/**`

Stage segment must map to an existing stage directory; reject with `reason: "invalid_stage"` otherwise.

### Deny-list (MCP-TOOL-CONTRACT.md §5.2)

- `stages/{stage}/units/*.md` → `reason: "deny_list_match"`
- `stages/{stage}/feedback/*.md` → `reason: "deny_list_match"`
- `intent.md` → `reason: "deny_list_match"`
- `stages/{stage}/state.json` → `reason: "deny_list_match"`
- `baseline.json` (any) → `reason: "deny_list_match"`
- `drift-markers.json` → `reason: "deny_list_match"`
- `write-audit.jsonl` → `reason: "deny_list_match"`
- `drift-assessments/**` → `reason: "deny_list_match"`
- Path escaping intent dir (`..`, symlinks) → `reason: "path_escape"`
- No allow-list match → `reason: "no_allow_match"`
- Stage segment not in existing stages → `reason: "invalid_stage"`

### Kill-switch (`drift_detection: false` in `.haiku/settings.yml`)

- Tool still writes the file.
- Tool still stamps the action-log entry.
- Tool skips `appendWriteAudit`.
- Response: `audit_log_appended: false` + `reason: "drift_detection_disabled"`.

---

## Risks and Blockers

1. **Tick counter access** — The `haiku_human_write` tool needs the current tick
   counter to form the `HWM-{tick}-{n}` entry ID. It is NOT in an active tick
   context (it's callable at any time). Resolution: read the active stage's
   `state.json` for `iteration` (tick counter equivalent) via `readJson`; if
   absent, default to `0`. This matches how `haiku_baseline_init` reads state.
2. **Session ID** — The MCP session identifier is not easily accessible from a
   tool handler. Resolution: pass `null` per the contract's "null if not
   accessible" clause.
3. **Sequential entry ID within a session** — No persistent counter for the
   sequence number. Resolution: read `write-audit.jsonl` line count at write
   time, add 1. Race is fine — the ID is for human cross-reference, not a
   primary key.
4. **Path validation** — `resolve()` + `startsWith` check must handle symlinks
   that point outside the intent directory. The existing `haiku_baseline_init`
   pattern only guards `..` traversal; we need `realpathSync` for symlink
   resolution too. Risk: `realpathSync` throws when the path doesn't exist yet
   (for new files being created). Resolution: resolve the PARENT directory only;
   the file itself need not exist yet.
5. **`outputs/` alias** — `canonicalisePath` from `drift-baseline.ts` handles
   this correctly; use it during path validation and in the response.

---

## Implementation Steps

### Step 1 — Implement `haiku_human_write.ts`

File: `packages/haiku/src/tools/orchestrator/haiku_human_write.ts`

Structure:

```
1. File header comment (purpose, contract references)
2. Imports
3. Helper: isDriftDetectionDisabled(root) — same pattern as haiku_baseline_init
4. Helper: getIntentStages(intentDir) — same as haiku_baseline_init
5. Helper: validatePath(pathRel, intentDir) — deny-list then allow-list
6. Helper: getTickCounter(intentDir) — read active stage state.json
7. Helper: getNextSequenceNumber(intentDir) — count lines in write-audit.jsonl
8. export default defineTool({ ... }) — the main handler
```

**Input schema** (Zod-style JSON Schema):

```
path: string (required)
content: string (required)
content_encoding: "utf-8" | "base64" (optional, default "utf-8")
human_author_id: string (optional)
rationale: string (optional)
overwrite: boolean (optional, default true)
create_dirs: boolean (optional, default true)
```

**Handler logic** (in order):

1. Validate `intent_slug` arg (use `validateSlugArgs`).
2. Resolve `intentDir` via `findHaikuRoot`.
3. Validate intent exists (check `intent.md`).
4. Check for archived intent (check frontmatter `archived: true`).
5. Check `content_encoding` — if not `"utf-8"` or `"base64"`, return `invalid_content_encoding`.
6. Decode content. If `content_encoding === "base64"`, `Buffer.from(content, "base64")`. If empty after decoding, return empty-content error.
7. Check `human_write_require_rationale` plugin setting; if true and rationale absent, return `rationale_required`.
8. Canonicalise `path` with `canonicalisePath`.
9. Validate path with `validatePath` helper — deny-list first, then allow-list + stage existence check.
10. Compute `sha256` over the decoded bytes (use `createHash("sha256")` on the buffer directly — no need to stream since content is already in memory).
11. Resolve absolute path = `join(intentDir, canonicalPath)`.
12. If `overwrite: false` and file exists → return `path_already_exists` with `existing_sha`.
13. If `create_dirs: false` and parent dir missing → return `parent_dir_missing`.
14. If `create_dirs: true`, `mkdirSync(parentDir, { recursive: true })` and track created dirs.
15. Write atomically: write to `tmpPath = join(parentDir, ".hwm-tmp-<pid>-<random>.tmp")`, then `rename(tmpPath, destPath)`. Wrap in try/finally to unlink tmpPath on failure.
16. Get `tickCounter` and `sequenceNumber`. Form `entryId = nextEntryId(tick, seq)`.
17. Get `isDriftDisabled = isDriftDetectionDisabled(root)`.
18. Check kill-switch for action-log:
    - If NOT disabled: call `appendActionLogEntry(intentDir, tickCounter, { entry_type: "human_write", path: canonicalPath, sha, author_class: "human-via-mcp", timestamp, human_author_id: humanAuthorId ?? null, entry_id: entryId, tick_counter: tickCounter })`.
    - If disabled: skip action log too (kill-switch makes everything a no-op per §8.5).
    - **Correction**: re-reading ARCHITECTURE.md §8.5: "tool still writes the file and stamps the action log, but skips the audit-log append." So the action log IS stamped even when disabled; only the audit log is skipped.
19. Build `WriteAuditRecord`.
20. If NOT disabled: `appendWriteAudit(intentDir, auditRecord)`. Capture `{ ok, reason? }`.
21. Return response: `{ ok: true, path: canonicalPath, sha, author_class: "human-via-mcp", timestamp, human_author_id, dirs_created, action_log_entry_id: entryId, audit_log_appended: ok, ...(disabled ? { reason: "drift_detection_disabled" } : {}) }`.

**Note on kill-switch** (correcting step 18 above based on MCP-TOOL-CONTRACT.md §8 + ARCHITECTURE.md §8.5):
- ARCHITECTURE.md §8.5 says: "tool still writes the file and stamps the action log, but skips the audit-log append."
- MCP-TOOL-CONTRACT.md §6.2 confirms the action-log entry is always stamped.
- So: action log = ALWAYS (even when disabled); audit log = ONLY when enabled.
- Response `audit_log_appended: false` with `reason: "drift_detection_disabled"` when disabled.

### Step 2 — Register in index.ts

File: `packages/haiku/src/tools/orchestrator/index.ts`

Add import and entry in the array (alphabetical by tool name):
```typescript
import haiku_human_write from "./haiku_human_write.js"
// ... add to array: haiku_human_write,
```

### Step 3 — Implement test file

File: `packages/haiku/test/haiku-human-write.test.mjs`

**Test structure** (using the same pattern as `haiku-baseline-init.test.mjs`):

```javascript
const { setHaikuRootForTests } = await import("../src/state/shared.ts")
const toolModule = await import("../src/tools/orchestrator/haiku_human_write.ts")
const tool = toolModule.default
```

**Fixtures**:
- `makeIntent(slug, { stages, archived })` — creates `.haiku/intents/{slug}/intent.md` with optional frontmatter.
- `makeStages(intentDir, stages)` — creates `stages/{s}/state.json` for each stage.

**Test cases** (cover all feature scenarios):

1. Happy path — writes file, stamps action log, does NOT update baseline.json, returns correct shape.
2. Audit log records all 12 fields including `user_instruction_excerpt`.
3. Deny-list: `stages/design/state.json` → `path_outside_tracked_surface` + `reason: "deny_list_match"` + no audit append.
4. Deny-list: `write-audit.jsonl` itself → same error.
5. Path escape: `../../../etc/passwd` → `reason: "path_escape"` + no file written.
6. Empty content: `content: ""` → empty content error.
7. Trust+Audit interactive mode: write proceeds without confirmation (no hook intervention tested directly — test that the tool completes successfully).
8. Trust+Audit autopilot mode: identical to interactive — same code path, just verified the tool doesn't require mode.
9. Path normalisation: absolute path resolving inside intent dir → accepted (canonical path in response).
10. Absolute path escaping intent dir → `reason: "path_escape"`.
11. `human_author_id`, `rationale`, `user_instruction_excerpt` carry through to audit log literally.
12. Kill-switch: `drift_detection: false` → file written, action log stamped, audit log skipped, `audit_log_appended: false` + `reason: "drift_detection_disabled"`.
13. `overwrite: false` on existing file → `path_already_exists` with `existing_sha`.
14. `create_dirs: false` with missing parent → `parent_dir_missing`.
15. `content_encoding: "base64"` → file written correctly (decode base64, write bytes).
16. `human_write_require_rationale: true` setting + no rationale → `rationale_required` error.
17. Hook compatibility: guard-workflow-fields does NOT block `haiku_human_write` (test that deny-listed paths return the error FROM the tool, not from the hook — the hook only guards Read/Write/Edit/MultiEdit tool names, not haiku_human_write).

### Step 4 — Verification

Run:
1. `bunx biome check packages/haiku/src/tools/orchestrator/haiku_human_write.ts`
2. `bun run --cwd packages/haiku typecheck`
3. `bun run --cwd packages/haiku test`
4. `! grep -nE '\bTBD\b|\bTODO\b' packages/haiku/src/tools/orchestrator/haiku_human_write.ts`

---

## File Impact Summary

| File | Action |
|---|---|
| `packages/haiku/src/tools/orchestrator/haiku_human_write.ts` | **CREATE** — primary deliverable |
| `packages/haiku/src/tools/orchestrator/index.ts` | **MODIFY** — add import + registry entry |
| `packages/haiku/test/haiku-human-write.test.mjs` | **CREATE** — test file |

No other files require modification. The tool reuses all existing infrastructure
(drift-baseline, write-audit, action-log, defineTool) without introducing new
dependencies.

---

## Key Decisions

1. **Tick counter**: Read `stages/{first-stage}/state.json` `.iteration` field;
   default to `0` if absent. This is the simplest approach that doesn't require
   understanding which stage is currently active — for audit purposes, a best-
   effort tick counter is sufficient.
2. **Sequence number**: Count existing lines in `write-audit.jsonl`; add 1.
   Racy under heavy concurrent load but acceptable for v1.
3. **SHA computation**: Compute over the in-memory buffer using `createHash`,
   not by streaming the file after write — avoids a disk read-back and races.
4. **Symlink escape**: Resolve parent directory with `realpathSync`; the
   destination file itself need not exist yet (being created). If `realpathSync`
   fails on the parent, reject with `path_escape`.
5. **`outputs/` alias**: `canonicalisePath` from `drift-baseline.ts` handles
   rewriting to `artifacts/`. Apply before validation and use the canonical form
   in all responses and log entries.
