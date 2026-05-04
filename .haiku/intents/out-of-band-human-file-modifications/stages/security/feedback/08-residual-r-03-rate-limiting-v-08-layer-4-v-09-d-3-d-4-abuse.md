---
title: 'Residual R-03: Rate limiting (V-08 Layer 4 + V-09/D-3/D-4 abuse prevention)'
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-05-03T09:05:05Z'
iteration: 1
visit: 1
source_ref: stages/security/artifacts/ASSESSMENTS.md#r-3
closed_by: 'deferred-to-followup-iteration:rate-limiting'
bolt: 0
triaged_at: '2026-05-03T09:05:05Z'
resolution: stage_revisit
replies: []
---

## Deferred residual risk — rate limiting (mandate gap)

**Owning vulns**: V-08 (CSRF defense Layer 4), V-09 (per-session classify cap), threat rows D-3 (slowloris on multipart) + D-4 (rapid-fire `haiku_classify_drift`).

**Why deferred**: Three-layer CSRF defense (commit `bed443315`) closes the cross-origin form-post path — V-08 direct exploitation. Per-IP rate-limit is the abuse-prevention layer that protects against credential stuffing / brute force / sustained abuse by an attacker who already holds a valid token. Lower priority than direct-exploit close.

**Severity if unfixed**: Medium (token leak + sustained abuse becomes amplified). Today: Low (token TTL plus EPHEMERAL_SECRET process rotation cap the abuse window).

**Recommended target iteration**: Next security wave; co-locate with `unit-05-rate-limiting` (already referenced in unit-03 spec's "Out of scope" section).

**Scope**:
1. Per-IP rate limit on mutating tunnel-mode routes (POST/PUT/PATCH/DELETE under `/api/intents/:intent/uploads/*` and `/api/feedback/*`). Token-bucket: 30 req/min sustained, burst 10.
2. Per-session cap on `haiku_classify_drift` (e.g. 100 calls per session lifetime; structured `classify_rate_limited` error past the cap).
3. Cumulative-bytes-per-intent quota — total bytes uploaded to an intent capped at e.g. 1 GiB; structured `intent_storage_quota_exceeded` error past quota.
4. Slowloris defense: explicit `connectionTimeout` / `requestTimeout` settings on multipart routes shorter than the default (current default is 60 s; 30 s is enough for legitimate uploads).
5. `haiku.security.rate_limited` telemetry on every rejection so abuse patterns surface to operators.

**Affected components**:
- `packages/haiku/src/http/csrf.ts` (extend the global preHandler)
- `packages/haiku/src/http/upload-routes.ts` (per-route quota check)
- `packages/haiku/src/state-tools.ts` (`haiku_classify_drift` per-session counter)

**Source**: ASSESSMENTS.md §4 R-3; THREAT-MODEL.md §3.5 D-3, D-4.
