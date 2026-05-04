---
title: 'R-04 (LOW): attribute_to_user unvalidated, audit-log poisoning'
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-05-03T02:58:43Z'
iteration: 1
visit: 1
source_ref: stages/security/artifacts/RED-TEAM-unit-01.md#finding-r-04
closed_by: 'fix-loop:FB-04:bolt-1'
bolt: 1
triaged_at: '2026-05-03T02:58:43Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T08:30:42Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-05-03T08:39:08Z'
    result: closed
---
## Summary

`attribute_to_user` is parsed from multipart and stored verbatim — no validation — into:

- `action-log.jsonl` (`human_author_id`, `upload-routes.ts:632`)
- `write-audit.jsonl` (`human_author_id`, `upload-routes.ts:644`)

Attacker sends `attribute_to_user=<img src=x onerror=alert(1)>`. Strings persist in JSONL files. Any SPA view that renders the audit log without escaping (assessments review UI, drift-history pane, future audit viewer) becomes a Reflected-Stored XSS hybrid — attacker controls the payload via upload, reviewer triggers it by viewing the log.

Co-located with the upload-validation surface (same multipart handler) so it belongs in this unit's fix loop, not deferred to a future audit-rendering hardening unit.

## Recommended fix

Validate `attribute_to_user` at upload time:

```ts
const ATTRIBUTE_TO_USER_RE = /^[\w][\w\-.@ ]{0,127}$/
if (!ATTRIBUTE_TO_USER_RE.test(attributeToUser)) {
  reply.status(400).send({
    error: "bad_attribute_to_user",
    code: "bad_attribute_to_user",
    message: "attribute_to_user must be 1-128 chars matching [\\w][\\w\\-.@ ]+",
  })
  return
}
```

Apply same validator on both `/uploads/stage-output` and `/uploads/knowledge` routes.

## Acceptance

- Validator rejects HTML/script payloads in `attribute_to_user`.
- Validator accepts the existing happy-path values used in tests (e.g. `alice`, `designer`).
- New regression test: `attribute_to_user="<script>alert(1)</script>"` → 400.
