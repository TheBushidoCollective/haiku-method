---
title: >-
  Upload allowlist trusts client-supplied MIME with no magic-byte inspection —
  content-type spoof bypass
status: closed
origin: adversarial-review
author: mitigation-effectiveness
author_type: agent
created_at: '2026-05-03T11:06:07Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-34:bolt-1'
bolt: 1
triaged_at: '2026-05-03T11:06:07Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T12:20:57Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-05-03T12:23:19Z'
    result: closed
---
## Mandate violation

THREAT-MODEL.md §3.4 / §4.4 frames I-1 / I-2 (stored XSS via uploaded HTML/SVG) as closed by:

> Unit-01 ALLOWED_MIMES + BLOCKED_EXTENSIONS allowlist (commits `3867608a6`, `bfa4b7c91`)

The allowlist works on two inputs:
1. The MIME type the multipart client supplied (`filePart.mimetype`)
2. The filename extension

Both are client-controlled. Neither inspects the actual bytes.

```ts
// upload-routes.ts — verbatim from the upload handler
const stageMime = normaliseMime(filePart.mimetype)  // ← client-supplied
if (!ALLOWED_MIMES_STAGE_OUTPUT.has(stageMime)) { ... reject ... }
```

The threat (I-1/I-2 stored XSS) is at the SERVE side: when the file is GET'd back via `/files/`, `/stage-artifacts/`, etc., `serveFile` picks Content-Type from the EXTENSION (`MIME_TYPES[ext]` at `path-safety.ts:118`). So the attack is:

1. Attacker uploads `evil.png` with multipart `Content-Type: image/png` and body bytes `<html></html>`.
2. Both checks pass: extension `.png` is not blocked; MIME `image/png` is on the allowlist.
3. File lands at `stages/.../artifacts/evil.png`.
4. Reviewer GETs `/stage-artifacts/<sid>/stages/.../artifacts/evil.png`.
5. `serveFile` reads the file, sets `Content-Type: image/png` (from extension map).
6. **Most modern browsers respect Content-Type for `image/*`** — file fails to render as image, shown as broken image. SAFE under normal browser behavior.
7. **BUT**: combined with a missing `X-Content-Type-Options: nosniff` (FB-19), some user-agents — older browsers, content-detection middleboxes, security scanners that try to be helpful, image-search bots — re-sniff and may render as HTML.

This is the textbook "letter of the check passes but spirit is violated" pattern — the allowlist is supposed to enforce "only image/PDF/markdown/JSON content lands on disk" and it instead enforces "only image/PDF/markdown/JSON CLAIMS land on disk."

## Root cause vs symptom (mandate check)

- **Symptom**: a `.html` file with `Content-Type: text/html` is rejected.
- **Root cause**: any non-allowed file content can be uploaded under an allow-listed MIME and extension, because the server has no idea what the bytes ARE.

The allowlist as written says "I trust the client about both fields, and I trust the browser at serve time to respect the extension-derived Content-Type." Neither trust assumption is documented in the threat model.

## What "real" content validation looks like

For genuine first-line defense, the upload route should sniff the first ~512 bytes against well-known magic numbers:
- `image/png` → must start with `89 50 4E 47 0D 0A 1A 0A`
- `image/jpeg` → must start with `FF D8 FF`
- `application/pdf` → must start with `%PDF-` (`25 50 44 46 2D`)
- `image/gif` → `GIF87a` or `GIF89a`
- `image/webp` → `RIFF....WEBP`
- `application/json` / `text/markdown` / `text/plain` → harder to magic-sniff, but at minimum reject if the byte stream contains `"}` → assert rejected (or sanitized; document policy)

## Mitigation does not introduce new attack surface check (mandate)

`file-type` is a well-audited single-purpose library; magic-byte detection is read-only on a buffer slice. Low new attack surface vs the size of the gap it closes. If the team prefers no new dep, hand-rolled magic-byte tables for the 8 allowed MIMEs are < 100 LOC.

## Files / lines

- `packages/haiku/src/http/upload-routes.ts:153-176` — both `ALLOWED_MIMES_*` rely on client claim
- `packages/haiku/src/http/upload-routes.ts:543-552` — stage-output MIME check is purely string compare against `filePart.mimetype`
- `packages/haiku/src/http/upload-routes.ts:878-887` — knowledge route, same pattern
- `packages/haiku/src/http/path-safety.ts:118` — `MIME_TYPES[ext]` is extension-driven, doesn't recover from upload-time spoofing
- THREAT-MODEL.md §6.1 — mentions `@fastify/multipart` parser confusion mitigations but does NOT mention "client-supplied MIME is unverified" as a load-bearing assumption
- THREAT-MODEL.md §3.4 I-1/I-2 — "Closed: V-01/V-02 (allowlist + extension blocklist)" overstates the closure given the bytes are never inspected

This is in-spirit V-01/V-02: the threat is "uploaded executable content lands on a privileged origin"; the fix only blocks executable EXTENSIONS, leaving executable CONTENT under non-executable extensions wide open. Combined with FB-19 (nosniff missing) the path to exploitation is short.
