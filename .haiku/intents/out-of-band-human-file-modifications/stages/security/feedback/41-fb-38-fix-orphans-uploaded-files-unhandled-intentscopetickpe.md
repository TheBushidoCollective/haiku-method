---
title: >-
  FB-38 fix orphans uploaded files: unhandled IntentScopeTickPersistError skips
  action/audit-log after rename
status: closed
origin: adversarial-review
author: fix-assessor
author_type: agent
created_at: '2026-05-03T14:17:18Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-41:bolt-1'
bolt: 1
triaged_at: '2026-05-03T14:17:18Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T14:30:10Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-05-03T14:31:52Z'
    result: closed
---
## Regression introduced by FB-38 fix (commit 9a2391608)

The fix for FB-38 replaced `getIntentScopeTickCounter`'s silent-best-effort persistence with a hard `IntentScopeTickPersistError` throw. The producer-side change is correct in isolation, but neither of the two call sites was updated to handle the new throw. The result is a strictly worse failure mode than the one the fix was supposed to close.

## Call sites that need handling

### 1. `packages/haiku/src/http/upload-routes.ts:1007-1011`

```ts
const isIntentScope = stage === null
const knowledgeTickCounter = isIntentScope
    ? getIntentScopeTickCounter(iDir)   // ← can now throw
    : getCurrentTickCounter(iDir, stage as string)
```

This call sits at line 1009. The atomic rename has already succeeded at line 995 (`tmpPath = null // rename succeeded; tempfile is now the dest`). If `getIntentScopeTickCounter` throws now:

- The uploaded file is on disk at `destAbsPath`.
- `appendActionLogEntry` (line 1027) is skipped.
- `appendWriteAudit` (line 1030) is skipped.
- The async Fastify handler crashes; the SPA receives a generic 500 with no `entry_id`.

### 2. `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:776-780`

```ts
const stageMatch = canonicalPath.match(/^stages\/([^/]+)\//)
const isIntentScope = stageMatch === null
const tickCounter = isIntentScope
    ? getIntentScopeTickCounter(intentDir)   // ← can now throw
    : getCurrentTickCounter(intentDir, stageMatch[1])
```

Same shape: `safeMkdirAndRename` succeeded at line 730. The throw at 779 skips both the action-log append (795) and audit-log append (block beginning 815). The MCP tool returns an unstructured error rather than the documented `disk_write_failed` envelope at 716-727.

## Why this is worse than the pre-fix behavior

The original silent-failure produced "in-memory counter advances but disk doesn't" — a soft V-05 violation (next call could collide).

The post-fix unhandled-throw produces "file on disk has no action-log entry, no audit-log entry, and no entry_id" — the drift-detection-gate's union-of-action-logs read (`drift-detection-gate.ts`) now sees a tracked file with zero producer record. From the consumer's perspective, this is indistinguishable from an out-of-band human modification, which is the exact event class this entire intent exists to detect. The producer + consumer disagree about whether the file is workflow-attributed.

The fix's own docblock acknowledges this: "Callers MUST surface a hard failure rather than swallow." But neither caller was updated, so the contract is asserted but not enforced end-to-end.

## Concrete impact

- SPA upload path: file lands in `.haiku/intents/{slug}/knowledge/...` or `.haiku/intents/{slug}/stages/{stage}/knowledge/...` with no audit trail. Next drift-gate run flags it as out-of-band human modification.
- MCP `haiku_human_write` path: same — file lands in the canonical destination, no action/audit-log entry, drift gate sees a phantom modification.

Both surfaces lose the V-05 invariant they were trying to harden.

## Suggested remediation

In both `upload-routes.ts:1007` and `haiku_human_write.ts:776`, wrap the `getIntentScopeTickCounter` call in a try/catch on `IntentScopeTickPersistError` and:

- **upload-routes.ts**: rollback the just-rename'd file (`unlinkSync(destAbsPath)`), then return a 500 with a structured `code: "tick_persist_failed"` envelope. The reviewer can retry.
- **haiku_human_write.ts**: rollback the just-rename'd file, return the existing `disk_write_failed` envelope shape with a distinguishing `reason: "tick_persist_failed"` so the agent can surface it correctly.

In both cases the rollback restores the pre-call state so the V-05 contract holds: either everything (file + counter + entries) lands, or nothing does.

## Source references

- `packages/haiku/src/state-tools.ts:2314-2378` — new throwing implementation (commit 9a2391608)
- `packages/haiku/src/http/upload-routes.ts:995, 1009` — orphan-file window in SPA path
- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:730, 779` — orphan-file window in MCP path
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` — consumer that misclassifies orphans as out-of-band human writes

---

## Bolt 1 — security-engineer (resolution)

**Current state (pre-fix):** Both `upload-routes.ts:1009` (knowledge-uploads route) and `haiku_human_write.ts:779` called `getIntentScopeTickCounter(...)` bare. After FB-38's commit 9a2391608, that function throws `IntentScopeTickPersistError` on persistence failure. With the rename already landed and no try/catch, the file orphans on disk with no action-log/audit-log entry — the exact failure class the drift gate then flags as an out-of-band human modification.

**Desired state:** Either everything (file + counter + action-log + audit-log) lands, or nothing does. On `IntentScopeTickPersistError`, the just-rename'd file MUST be unlinked and the caller MUST surface a structured error envelope so the consumer can retry without leaving a phantom-modification breadcrumb.

**Gap:** Neither caller wrapped the throwing producer in a try/catch, and neither rolled back the rename on failure.

**Comparable working sibling:** The pre-rename failure path in both files already follows the rollback pattern — `cleanupTempFile(tmpPath)` is called on any pre-rename error and a structured error envelope is returned (`upload-routes.ts:977-993`, `haiku_human_write.ts:737-761`). The post-rename rollback uses `unlinkSync(destAbsPath)` because at this point the tempfile *is* the destination — `cleanupTempFile` would no-op since `tmpPath` is set to null after rename success.

**Fix applied (commit `f42186213`):**

1. **`packages/haiku/src/http/upload-routes.ts`**
   - Imported `IntentScopeTickPersistError` from `../state-tools.js`.
   - Wrapped the `getIntentScopeTickCounter` / `getCurrentTickCounter` ternary at lines 1009-1014 in a try/catch.
   - On `IntentScopeTickPersistError`: best-effort `unlinkSync(destAbsPath)` to roll back the rename, then `reply.status(500).send({ error: "tick_persist_failed", code: "tick_persist_failed", message: err.message })`. Other errors are rethrown so the existing Fastify error handling still surfaces them.
2. **`packages/haiku/src/tools/orchestrator/haiku_human_write.ts`**
   - Imported `IntentScopeTickPersistError` from `../../state-tools.js` and `unlinkSync` from `node:fs`.
   - Wrapped the same ternary at lines 781-783 in a try/catch.
   - On `IntentScopeTickPersistError`: best-effort `unlinkSync(destAbs)` to roll back the rename, then return the existing `disk_write_failed` envelope shape with `reason: "tick_persist_failed"` and a descriptive message. Other errors are rethrown.

Both rollback paths swallow the unlink error to remain best-effort: if the file was already removed externally we should not crash the rollback path itself.

**Verification:** `bun run typecheck` passes. Full test suite (1356 tests across 65 files) passes — including `upload-routes.test.mjs` (36 tests), `unit-03-security.test.mjs` (51 tests), `write-audit.test.mjs` (21 tests).

**V-05 invariant restored:** On tick-persist failure both surfaces now atomic-rollback to the pre-call state. The drift gate's union-of-action-logs read can no longer observe a tracked file with no producer record from these two call sites.
