---
title: >-
  @sentry/node third-party telemetry sink absent from dependency threat
  enumeration
status: closed
origin: adversarial-review
author: threat-coverage
author_type: agent
created_at: '2026-05-03T11:04:24Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-18:bolt-1'
bolt: 1
triaged_at: '2026-05-03T11:04:24Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T12:18:07Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-05-03T12:23:11Z'
    result: closed
---
## Finding

THREAT-MODEL.md §6 enumerates `@fastify/multipart`, `gray-matter`, `@opentelemetry/*`, and `jsonwebtoken` as third-party-dependency threat surfaces. `@sentry/node` — a real, in-tree dependency at `packages/haiku/package.json` line 8 (`"@sentry/node": "^10.47.0"`) used by `packages/haiku/src/sentry.ts` — is omitted entirely.

`packages/haiku/src/sentry.ts:43-45`:
```
Sentry.withScope((scope) => {
    ...
    Sentry.captureException(err, { extra: context })
})
```

Every captured exception ships its `extra: context` object outbound to Sentry's SaaS endpoint. The `context` payload commonly includes file paths, intent slugs, agent-supplied identifiers, and depending on call-site, may include excerpts of state. This is the same exfiltration class the §6.3 OTel enumeration calls out ("PII leak: every `recordEvent` payload should be reviewed for attribute names that include user/agent-supplied content"), but with a stronger consequence (exceptions are by definition unplanned, so coverage of "what flows into `extra`" is harder to constrain than telemetry attrs).

Also: `packages/haiku/src/sentry.ts:63 Sentry.captureFeedback({ ... })` ships user/agent feedback content directly to the Sentry SaaS — the `feedback_creates[].body` sanitizer (V-10 fix) protects the disk-stored copy but does NOT cover the path that flows the same content into Sentry.

## Why this is a threat-coverage gap

The mandate requires "third-party dependencies are included in the threat surface". `@sentry/node` is a third-party dependency that:
- Establishes an outbound network channel to a SaaS the operator may not control
- Receives error context (paths, slugs, agent inputs)
- Receives feedback bodies via `captureFeedback`
- Has its own supply-chain footprint (Sentry's transitive deps, Sentry's own auth-token handling)

Severity-wise this matches §6.3 OTel ("redact path tail, never include file content") and deserves the same enumeration depth.

## Required fix

Add §6.5 (or insert before/after §6.3 OTel) `@sentry/node`:
- Outbound exfiltration threat: who can configure the DSN? Is the DSN env-var override reachable from a less-privileged context the way OTel's is?
- PII leak threat: enumerate which `extra: context` fields can carry user/agent content; recommend an `extra` allowlist (or a redaction wrapper) at the `reportError` chokepoint
- Feedback-leak threat: `captureFeedback` writes feedback bodies directly to Sentry — name this and recommend either (a) gating `captureFeedback` behind explicit operator opt-in, or (b) running the same sanitizer that V-10 applies to disk-stored feedback before sending to Sentry
- Recommendation: pin minor version, watch GHSA, never ship raw rationale/feedback body/file content as `extra`

## Files

- `packages/haiku/package.json:8` (the dependency)
- `packages/haiku/src/sentry.ts:1-90` (the client)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md:363-453` (§6 dependency enumeration — the gap)
