---
title: >-
  Reliability: /health endpoint covers process-liveness only, does not verify
  readiness of dependencies
status: rejected
origin: adversarial-review
author: reliability (from operations)
author_type: agent
created_at: '2026-05-03T11:02:53Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 0
triaged_at: '2026-05-03T11:02:53Z'
resolution: null
replies: []
---

## Finding

The `/health` endpoint at `packages/haiku/src/http/default-routes.ts:37-43` returns `200 "ok"` as soon as `isReady()` returns true. `isReady()` is set to `true` at `packages/haiku/src/http.ts:416` immediately after `app.listen()` resolves and `app.server.maxConnections` is set:

```ts
ready = true
return actualPort as number
```

It does NOT verify any of the security-stage's dependencies are reachable / functional:

1. **Intent-directory writability** — the upload routes (`/api/intents/:intent/uploads/{stage-output,knowledge}`) and `haiku_human_write` MCP tool depend on `.haiku/intents/<slug>/` being writable. A read-only-mounted `.haiku/` (e.g., container with wrong volume mount) makes every mutating route 5xx, but `/health` returns 200.
2. **Baseline-storage readability** — the drift-detection gate depends on `baseline.json` + `baseline-content/` being readable. A corrupt or unreadable baseline storage makes every workflow tick fail with `baseline_corrupt`, but `/health` returns 200.
3. **OTel collector reachability** — the security stage relies on telemetry events (`haiku.security.baseline_thrash`, `haiku.upload.cap_clamped`, `haiku.security.rate_limited`) for operator alerting. If the collector is unreachable, security alerts are dropped silently (see separate finding on telemetry retry/circuit-breaker), but `/health` returns 200.
4. **`fastify-rate-limit` warm-up** — the global rate-limiter registered at `http.ts:239-243` uses an in-memory store; if a hypothetical future Redis-backed store is misconfigured, rate-limiting silently disables, but `/health` returns 200.

## Mandate spirit

The reliability mandate says "verify that health checks cover **actual readiness**, not just process liveness." A health check that flips to ready as soon as the listener binds is process-liveness in disguise — the kind of check that load balancers route traffic to even when the underlying service can't actually serve requests.

## Why this is in scope for the security stage

The security stage added net-new mutating routes (`uploads/*`, csrf nonce mint, assessments routes) and net-new MCP tools (`haiku_human_write`, `haiku_baseline_init`, `haiku_classify_drift`) all of which depend on intent-directory writability. The stage is the natural owner of the readiness contract for those new surfaces because the stage introduced them.

## Recommended fix

Extend `/health` to perform a readiness probe that:

1. Probes a known intent dir (or a sentinel `.haiku/.health-probe` file) is writable — write + delete a 0-byte file, fail-fast if it errors.
2. Probes baseline storage path is readable — `statSync` on the baseline dir.
3. Optionally probes OTel collector reachability with a timeout — return `degraded` (200 with `{status: "degraded", reasons: [...]}`) rather than 503 if telemetry is degraded but core surfaces work.

Cite a regression test that asserts `/health` returns 503 when the intent dir is read-only (chmod 0500 or read-only mount) so the readiness contract has a paired test the way every other security control does.

## Severity

**Medium** — operator-facing reliability gap. The current behavior means a partially-broken process (intent dir unwritable, baseline corrupt, telemetry collector down) appears healthy to load balancers, tunnel probes, and any monitoring that gates on `/health`. The first time anyone notices is when a reviewer's upload returns 500 or the drift gate refuses to advance.

## Files affected

- `packages/haiku/src/http/default-routes.ts:37-43` (the `/health` handler)
- `packages/haiku/src/http.ts:79-91, 416` (`isReady()` semantics)

---

**Rejection reason:** Out of intent scope (same rationale as the operations-stage rejection of the equivalent /health readiness finding). The /health endpoint is process-liveness today; making it drift-aware (probing baseline integrity, kill-switch state, FS writability, OTel reachability) is an HTTP-layer redesign that belongs in a follow-on intent focused on operational health checks, not the per-stage drift-detection rollout. Deferring with a stage_revisit FB pre-tagged "follow-up: drift-aware /health" if needed.
