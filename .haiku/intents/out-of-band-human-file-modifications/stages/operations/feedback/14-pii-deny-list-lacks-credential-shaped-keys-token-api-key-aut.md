---
title: >-
  PII deny-list lacks credential-shaped keys (token, api_key, authorization,
  password, secret, bearer)
status: closed
origin: adversarial-review
author: security (from development)
author_type: agent
created_at: '2026-05-02T05:32:25Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-14:bolt-2'
bolt: 2
triaged_at: '2026-05-02T05:32:25Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: ops-engineer
    completed_at: '2026-05-02T05:54:47Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-05-02T05:55:52Z'
    result: closed
integrator_attempts: 1
---
## Finding

The runtime PII deny-list at `packages/haiku/src/telemetry.ts:328-339` enumerates body-shaped keys that are stripped from telemetry attributes before serialization:

```
diff_unified, excerpt, file_content, file_body,
user_email, user_name, message_body,
finding_body, fb_body, content
```

This is the runtime safety net unit-02 introduced ("on top of the static-grep CI gate") to prevent body-shaped values from leaking. However, the set covers only **content/body**-shaped keys. Standard credential-shaped keys are NOT denied:

- `password`, `passwd`, `pwd`
- `token`, `access_token`, `refresh_token`, `id_token`, `bearer_token`, `bearer`
- `api_key`, `apikey`, `api-key`
- `authorization`, `auth_header`, `auth`
- `secret`, `client_secret`, `signing_secret`
- `credential`, `credentials`
- `session_id`, `cookie`
- `private_key`, `pem`

Verified:
```
$ grep -n "password\|token\|api_key\|secret\|authorization\|bearer\|credential" packages/haiku/src/telemetry.ts
100:// This is the standard mechanism for rotating auth tokens (Authorization
101:// bearer, short-lived API keys). We merge those headers on top of the env-
```

The only references are documentation about OTLP headers; nothing in `PII_DENY_KEYS`.

## Why this is a security finding (mandate: secrets not hardcoded or logged)

The mandate explicitly requires: "secrets are not hardcoded or logged." The runtime PII gate is the operations-stage deliverable that enforces this for telemetry — it's the layer that catches a future code change emitting an attribute the static-grep gate didn't anticipate. The static gate at `packages/haiku/test/telemetry-otel.test.mjs:720-750` is itself derived from `PII_DENY_KEYS` (it asserts "no schema may declare a key that lives in the PII deny list"), so a key that's not in the runtime set is also not enforced statically. Both layers have the same gap.

Today no telemetry emit site uses these key names — but that's the exact failure mode the runtime gate exists to prevent: an emit site introduced in a future PR that uses `auth_header: req.headers.authorization` or `token: ctx.session.token`. The static-grep gate would not catch it (the deny list doesn't name those keys); the runtime gate would not strip it; the OTLP backend would receive a credential.

## Spirit of the mandate

The mandate names "representative concerns, not the exhaustive set" (lens guidance). User-content (`*_body`, `excerpt`) is in the set; credential-content is the obviously-symmetric concern that's missing. The runbook scenario `pii-deny-list-strip` says "Every strip is a bug — either the static CI gate has a hole or a new emit site bypassed it." That mandate is impossible to satisfy for credential keys today because they're in neither gate.

## Fix shape (suggestion, do not implement here)

Extend `PII_DENY_KEYS` in `packages/haiku/src/telemetry.ts` to include the credential-shaped keys above. Mirror the addition in the static-grep test at `packages/haiku/test/telemetry-otel.test.mjs` (the schema-key gate at lines 720-750). The runbook's `pii-deny-list-strip` section already covers the operator response — it does not need to change.

Optional but stronger: case-fold the deny check (`PII_DENY_KEYS.has(key.toLowerCase())`) so `Authorization`, `AUTHORIZATION`, `Authorization-Bearer` are caught equivalently. Today `sanitizeAttributes` is exact-match.

## Refs

- `packages/haiku/src/telemetry.ts:328-339` (current deny-list)
- `packages/haiku/src/telemetry.ts:347-365` (`sanitizeAttributes` exact-match check)
- `packages/haiku/test/telemetry-otel.test.mjs:467-565` (deny-list test surface)
- `.haiku/knowledge/RUNBOOK.md:548-585` (`pii-deny-list-strip` scenario asserts every strip is a bug; relies on completeness of the deny set)
