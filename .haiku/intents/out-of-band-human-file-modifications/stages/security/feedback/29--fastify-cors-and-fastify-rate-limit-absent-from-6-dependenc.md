---
title: '@fastify/cors and @fastify/rate-limit absent from §6 dependency enumeration'
status: closed
origin: adversarial-review
author: threat-coverage
author_type: agent
created_at: '2026-05-03T11:05:33Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-29:bolt-1'
bolt: 1
triaged_at: '2026-05-03T11:05:33Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T12:19:59Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-05-03T12:23:12Z'
    result: closed
---
## Finding

Two registered Fastify plugins that are load-bearing for the threat-model's stated mitigations are missing from §6 dependency enumeration:

1. **`@fastify/cors`** — `packages/haiku/package.json:5`, registered at `packages/haiku/src/http.ts:14`. THREAT-MODEL.md §3.6 E-1 names "Origin allowlist (`HAIKU_ALLOWED_ORIGINS`)" as CSRF defense Layer 2. That allowlist is implemented by `@fastify/cors` (see `packages/haiku/src/http/default-routes.ts:55,62,81` — explicit comments referencing `node_modules/@fastify/cors/index.js:79`). The mitigation correctness depends on `@fastify/cors`'s Origin-comparison semantics, preflight-handling behavior, and how it interacts with the OPTIONS-route ownership it claims.

2. **`@fastify/rate-limit`** — `packages/haiku/package.json:6`, registered at `packages/haiku/src/http.ts:239` ("FB-06: register @fastify/rate-limit in remote mode"). The plugin IS wired today in tunnel mode. Its threat surface (per-IP key-derivation, X-Forwarded-For trust, store-backend choice, bypass-via-header-spoofing) is uncharacterized.

Neither plugin appears in §6 alongside `@fastify/multipart`, `gray-matter`, `@opentelemetry/*`, `jsonwebtoken`.

## Why this is a threat-coverage gap (and contradicts the deferred-risk register)

The mandate requires "third-party dependencies are included in the threat surface" AND "trust boundaries are correctly identified". Two boundary-crossing plugins are missing — and one of them creates an internal contradiction:

- **§4 R-3** (`ASSESSMENTS.md:125-157`) says "Per-IP rate-limit on mutating tunnel-mode routes still missing — Layer 4 of typical CSRF defense-in-depth. Deferred — see §4 row R-3 (rate limiting)".
- **`packages/haiku/src/http.ts:239`** registers `fastifyRateLimit` in remote (tunnel) mode.

Either:
(a) The registered limiter does not cover mutating routes (in which case THREAT-MODEL needs to characterize what scope IS covered, e.g. "only the WS handshake, only auth-mint endpoints"); OR
(b) The registered limiter DOES cover mutating routes and ASSESSMENTS R-3 needs to retract or narrow the "missing" claim and instead enumerate what the present limiter does/does not protect (per-IP vs per-token, what limits, what error code on breach, X-Forwarded-For trust posture under localtunnel).

As written, a reviewer cannot determine the actual present rate-limit surface from the threat-model artifacts.

## Required fix

1. Add §6.5 / §6.6 entries for `@fastify/cors` and `@fastify/rate-limit` with the same structure as §6.1-§6.3:
   - **`@fastify/cors`**: Origin-comparison semantics (exact match vs prefix vs regex — what does `HAIKU_ALLOWED_ORIGINS` parse into?), preflight-handling for the multipart upload routes, OPTIONS-route ownership conflict surface (the `default-routes.ts` comments hint at this), wildcard handling.
   - **`@fastify/rate-limit`**: per-key derivation (defaults to IP — what happens when localtunnel forwards via X-Forwarded-For?), the configured `max` and `timeWindow` values currently in `http.ts:239`, store backend (in-memory loses state on process restart, same way EPHEMERAL_SECRET does), error-shape on breach, allowlist for csrf-nonce-mint endpoint.

2. Reconcile §4 R-3 in ASSESSMENTS.md with the registered limiter:
   - Read the actual `fastifyRateLimit` registration block and characterize coverage.
   - Update R-3 to "rate-limit IS registered — present coverage covers X, Y; gap is Z" rather than "rate-limit is missing".
   - The `connectionTimeout`/slowloris portion of R-3 is independent and can stay.

## Files

- `packages/haiku/package.json:5,6` (dependencies)
- `packages/haiku/src/http.ts:14,15,239` (registrations)
- `packages/haiku/src/http/default-routes.ts:55,62,81` (comments referencing fastify-cors internals — load-bearing knowledge)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md:363-453` (§6 — the gap)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md:125-157` (§4 R-3 — the contradiction)
