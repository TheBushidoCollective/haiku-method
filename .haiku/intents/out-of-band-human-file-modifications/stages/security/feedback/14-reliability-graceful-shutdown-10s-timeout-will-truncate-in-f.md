---
title: >-
  Reliability: graceful shutdown 10s timeout will truncate in-flight 50MB
  uploads, leaving orphaned tempfiles
status: closed
origin: adversarial-review
author: reliability (from operations)
author_type: agent
created_at: '2026-05-03T11:03:24Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'deferred-to-followup-iteration:graceful-shutdown-window'
bolt: 0
triaged_at: '2026-05-03T11:03:24Z'
resolution: stage_revisit
replies: []
---

## Finding

`packages/haiku/src/server.ts:356` sets `SHUTDOWN_TIMEOUT_MS = 10_000` for graceful shutdown. The graceful-shutdown sequence in `gracefulShutdown()`:

```ts
await server.close()      // close MCP stdio
await stopHttpServer()    // close Fastify HTTP+WS
await flushSentry()
```

is bounded to 10 seconds total (`hardExit` timer at `server.ts:362-367` forces `process.exit(1)` after that).

The security stage introduced multipart upload routes at `packages/haiku/src/http/upload-routes.ts` with `MAX_UPLOAD_BYTES_HARD_CAP = 50 * 1024 * 1024` (50 MiB). The upload streams to a tempfile staged in `intentRoot` (`upload-routes.ts:308-373`), then atomically renames into place via `safeMkdirAndRename`. Tempfile cleanup is **only** performed on `error` paths in `cleanupTempFile` callbacks — there is no orphan-cleanup pass on shutdown, and the rename happens AFTER the entire stream is buffered.

Reliability problems:

1. **In-flight upload truncation**: A 50 MiB upload over a residential / mobile / tethered connection at 1 MiB/s takes 50 seconds. SIGTERM + 10 s graceful shutdown forces `process.exit(1)` long before the upload completes. Fastify's `server.close()` has been called, so new sockets are refused, but the in-flight multipart stream is mid-flight on an open socket. The forced exit RSTs the connection, the client sees an aborted upload, and the tempfile is orphaned in `intentRoot/.tmp-*` (or wherever `tmpPath` resolved) because the error-path `cleanupTempFile` never fires — the process is gone.
2. **Audit-log inconsistency window**: If the upload happened to be partway through `appendActionLogEntry` / `appendWriteAudit` (the security stage's tamper-evident audit primitives), the action-log line may be partially written but the destination file isn't yet renamed into place. The next process start observes an action-log entry pointing at a destination file that doesn't exist — exactly the "silent drop" condition the security stage's drift-detection gate is supposed to catch and the next tick will surface as a phantom drift event.
3. **No tempfile sweep on startup**: There is no recovery pass that scans `intentRoot/.tmp-*` on `startHttpServer()` and deletes orphaned tempfiles, so they accumulate over restart cycles.

## Mandate spirit

The reliability mandate says "verify that graceful shutdown handles in-flight requests." A shutdown timeout shorter than a legitimate request's expected duration does not handle in-flight requests — it kills them. The compounding factor for the security stage is the audit-log inconsistency: the security stage's whole drift-detection model assumes audit-log is the source of truth for what was written, and a shutdown-mid-write breaks that invariant.

## Why this is in scope for the security stage

The security stage:
- Introduced the upload routes that can take 50+ seconds to complete on slow links (V-07 `MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB`).
- Introduced the action-log + write-audit append primitives (`appendActionLogEntry`, `appendWriteAudit`) that depend on completion-vs-truncation invariants for tamper-evidence (V-03).
- Documented the drift-detection gate as the compensating control for unannounced writes — but the gate cannot distinguish "shutdown-truncated upload that left a tempfile" from a real attack.

## Recommended fix

1. **Extend `SHUTDOWN_TIMEOUT_MS`** to at least `2 * (MAX_UPLOAD_BYTES_HARD_CAP / minimum_realistic_throughput)` — for 50 MiB at 1 MiB/s, that's 100 s; recommend `60_000` (60 s) as a balanced default with env override `HAIKU_SHUTDOWN_TIMEOUT_MS`.
2. **Add a tempfile-sweep on `startHttpServer()`** that scans every `<intentRoot>/.tmp-*` and deletes files older than 1 hour (assume any tempfile that survived a process restart is orphaned).
3. **Fastify-aware drain**: pass `force: false` (default) and verify `app.close()` waits for in-flight handlers to finish. Document in the runbook that a long-running upload at SIGTERM time will block shutdown up to the timeout — operators should not hot-restart during heavy upload activity.
4. **Add a regression test** that opens a slow upload (using a `Readable.from()` that emits 1 KB / 100 ms, total 50 KB) then calls `stopHttpServer()` and asserts (a) the upload either completes or the tempfile is cleaned up; (b) no orphaned tempfile remains in `intentRoot`.

## Severity

**Medium-High** — reliability + integrity. The truncation alone is reliability; the audit-log inconsistency is integrity (security stage's V-03 trust hinge depends on audit-log completeness). Operationally this hits any time a deploy pushes a new MCP version mid-review.

## Files affected

- `packages/haiku/src/server.ts:356-381` (graceful shutdown timeout + sequence)
- `packages/haiku/src/http/upload-routes.ts:292-373` (tempfile staging without orphan-recovery)
- `packages/haiku/src/http.ts:425-447` (`stopHttpServer()` — no tempfile-sweep coordination)
