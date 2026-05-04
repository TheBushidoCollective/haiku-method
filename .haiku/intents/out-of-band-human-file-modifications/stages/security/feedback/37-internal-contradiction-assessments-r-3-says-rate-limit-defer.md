---
title: >-
  Internal contradiction: ASSESSMENTS R-3 says rate-limit deferred, but
  @fastify/rate-limit is wired in http.ts:239
status: closed
origin: adversarial-review
author: threat-coverage
author_type: agent
created_at: '2026-05-03T11:06:25Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-37:bolt-3'
bolt: 3
triaged_at: '2026-05-03T11:06:25Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 3
    hat: security-engineer
    completed_at: '2026-05-03T14:15:03Z'
    result: advanced
  - bolt: 3
    hat: feedback-assessor
    completed_at: '2026-05-03T14:17:13Z'
    result: closed
---
## Finding

Two artifacts disagree about the present state of rate-limiting:

**ASSESSMENTS.md §4 R-3** (`.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md:125-157`):
> "Per-IP rate-limit on mutating tunnel-mode routes still missing — Layer 4 of typical CSRF defense-in-depth. Deferred — see §4 row R-3 (rate limiting)."

**THREAT-MODEL.md §3.5 D-3**:
> "Slowloris residual risk is **unmitigated** until rate-limiting + connection-timeout work lands"

**Implementation** (`packages/haiku/src/http.ts:14, 221, 239`):
```
import fastifyRateLimit from "@fastify/rate-limit"
...
// FB-06: register @fastify/rate-limit in remote mode. The dependency
...
await instance.register(fastifyRateLimit, { ... })
```

`@fastify/rate-limit` is in `packages/haiku/package.json:6` (`"@fastify/rate-limit": "^10.2.2"`). It IS registered in `buildApp()` for remote mode. The "FB-06" comment indicates this is intentional, prior, addressed work — but the threat model treats it as nonexistent.

## Why this is a threat-coverage gap

The mandate requires "each identified threat has a specific mitigation, not just 'we should address this'". Today the threat model says "we should address this" (R-3 deferred) for a primitive that IS present. This means:

1. A reviewer reading the threat model cannot determine the actual present rate-limit posture (what's the per-IP limit? per-token limit? what window? what status code on breach?).
2. The deferred-risk register is overstated: at minimum SOME rate-limit defense IS in place, but its scope is uncharacterized.
3. A future reviewer cannot evaluate whether the present limiter is sufficient for the V-08 CSRF Layer-4 use case, the V-09 classify-drift abuse use case, or any other rate-limit-class threat — because the threat model has no row stating "the present limiter covers X but not Y".

## What the threat model needs to say

Read the actual `fastifyRateLimit.register()` call in `http.ts:239` and answer in §3.5 / §4 / §6:
- **What's the configured `max` and `timeWindow`?** (these are the bounds)
- **What's the per-key derivation?** (`request.ip`? `request.headers['x-forwarded-for']`? — under localtunnel, the X-Forwarded-For posture matters)
- **Which routes are covered?** (global preHandler, per-route, with allowlist for `/api/csrf-nonce`?)
- **What's the breach response?** (HTTP 429? structured error code? telemetry event?)
- **What's the store backend?** (in-memory — same EPHEMERAL_SECRET-style "lost on process restart" property)

Once those facts are recorded, R-3 in ASSESSMENTS can be tightened to: "Present limiter covers X with bounds Y/Z. Gaps remaining: per-route specialization for upload-vs-feedback routes (different abuse profiles), behind-localtunnel X-Forwarded-For trust posture (current key-derivation may collapse all tunnel traffic to one IP), connection-timeout for slowloris (separate from request-rate limiting)."

The slowloris-specific portion of R-3 (`connectionTimeout`/`requestTimeout`/`keepAliveTimeout`) is correctly identified as missing in §6.1 and is independent from request-rate limiting — that part of R-3 can stay as written.

## Required fix

Pick one and commit:

(a) Update THREAT-MODEL.md §3.5 D-3 / D-4 and §6 to enumerate the present `@fastify/rate-limit` registration and its actual scope; tighten ASSESSMENTS R-3 to name the specific gaps remaining (rather than the global "missing" claim).

(b) If the registered limiter is intentionally scoped to a subset that explicitly does NOT cover mutating routes (e.g. only the WS handshake), state that explicitly in the threat model and ASSESSMENTS, with the route-list and the rationale for the carve-out.

Either way, the contradiction must be eliminated.

## Files

- `packages/haiku/src/http.ts:14, 221, 239` (the registration)
- `packages/haiku/package.json:6` (the dependency)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md:236-237` (§3.5 D-3/D-4)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md:125-157` (§4 R-3)
