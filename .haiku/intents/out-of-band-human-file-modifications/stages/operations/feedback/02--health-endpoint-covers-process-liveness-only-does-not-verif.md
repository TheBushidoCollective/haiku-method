---
title: /health endpoint covers process liveness only — does not verify gate readiness
status: rejected
origin: adversarial-review
author: reliability
author_type: agent
created_at: '2026-05-02T05:30:18Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-02T05:30:18Z'
resolution: null
replies: []
---

**Finding:** The `/health` endpoint at `packages/haiku/src/http/default-routes.ts:37-43` checks only that the Fastify server has finished `listen()` and post-listen init. It does not verify any of the operational dependencies the drift gate needs to function:

- `.haiku/` directory writability (the gate writes baseline.json on every tick that establishes; if the volume is read-only the gate emits `write_failed` forever)
- Existence and parseability of intent baseline files (a corrupt baseline blocks gate advancement per `runDriftDetectionGate` baseline_corrupt branch at line 437-454)
- Whether the kill-switch is engaged (an operator's load balancer happily routes traffic to a host whose drift gate is OFF)
- Whether `HAIKU_UPLOAD_MAX_BYTES` parsed successfully (silently falls back to default at `upload-routes.ts:75`)

**Spirit-violation:** The reliability mandate explicitly states "health checks cover actual readiness, not just process liveness." The current endpoint is the textbook example of the anti-pattern the mandate names — it returns 200 OK while the underlying capability is broken.

**Evidence:**
- `packages/haiku/src/http/default-routes.ts:31-43` — the entire health implementation:
  ```
  if (!isReady()) { reply.status(503); return "starting" }
  return "ok"
  ```
  Where `isReady()` (defined at `http.ts:79-92`) is a single boolean flipped after `listen()`.
- `packages/haiku/src/http.ts:396-400` — comment confirms: "Post-listen initialization has completed. Flip the readiness flag so `/health` transitions from 503 `'starting'` to 200 `'ok'`."

There is no readiness probe equivalent that returns degraded for "gate is in baseline_corrupt or write_failed state." Operators have no programmatic signal that the host is unhealthy beyond raw OTLP telemetry, which is asynchronous and aggregated.

**Fix direction:** Add a `/ready` endpoint (separate from `/health` to preserve the existing liveness contract that load balancers use) that returns 503 when:
1. The kill-switch is engaged (`isDriftDetectionDisabled(haikuRoot)` is true) — because traffic to a host with detection off should not count as healthy.
2. Disk-write probe to `.haiku/.health-probe` fails (with a tempfile + delete pattern).
3. Recent telemetry shows a non-zero rate of `haiku.drift.baseline.corrupt` or `.write_failed` over the last N ticks (requires an in-process counter; trivially cheap).

Or document explicitly in the runbook that `/health` is **liveness-only by design** and operators must rely on `haiku.drift.gate.tick` telemetry for readiness — but that's a contract the mandate rejects.

---

**Rejection reason:** Out of operations-stage scope. The /health endpoint exists in packages/haiku/src/http/default-routes.ts as a process-liveness probe; making it drift-aware (probing baseline integrity, kill-switch state, FS writability) is an HTTP-layer redesign that belongs in a follow-on intent focused on operational health checks, not in the per-stage drift-detection rollout. The reliability mandate's "health checks cover actual readiness" applies more to deployed services with traffic shifting; this is a per-user MCP server with no traffic-routing layer that consumes /health.
