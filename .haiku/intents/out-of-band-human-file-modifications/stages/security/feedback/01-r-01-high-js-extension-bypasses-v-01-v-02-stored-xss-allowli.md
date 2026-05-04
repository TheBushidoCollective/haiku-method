---
title: 'R-01 (HIGH): .js extension bypasses V-01/V-02 stored-XSS allowlist'
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-05-03T02:57:57Z'
iteration: 1
visit: 1
source_ref: stages/security/artifacts/RED-TEAM-unit-01.md#finding-r-01
closed_by: 'fix-loop:FB-01:bolt-1'
bolt: 1
triaged_at: '2026-05-03T02:57:57Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T08:30:33Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-05-03T08:38:53Z'
    result: closed
---
## Summary

The V-01/V-02 fix landed an INCOMPLETE allowlist. `BLOCKED_EXTENSIONS` in `packages/haiku/src/http/upload-routes.ts:106-113` blocks only `.html`, `.htm`, `.svg`, `.xml`, `.xhtml`, `.mhtml`. It does NOT block `.js`. Combined with `application/octet-stream` being on `ALLOWED_MIMES_*` (lines 119-143), an attacker uploads `pwn.js` with MIME `application/octet-stream` → server accepts → file lands at `stages/{stage}/artifacts/pwn.js` → `serveFile` later returns `Content-Type: application/javascript; charset=utf-8` (per the MIME map in `path-safety.ts:17-31`) → stored-XSS under the reviewer's tunnel origin via any `<script src="...">` injection chain.

**Same threat model as V-01/V-02. Same severity (HIGH). Different file extension.**

## Reproduction

PoC test passes against the live HTTP route: `packages/haiku/test/red-team-unit-01-upload-bypass.test.mjs` — test `R-01: .js upload accepted via application/octet-stream MIME bypasses V-01/V-02 allowlist`.

```bash
$ npx tsx packages/haiku/test/red-team-unit-01-upload-bypass.test.mjs
  PASS R-01: .js upload accepted via application/octet-stream MIME bypasses V-01/V-02 allowlist
```

Server returns 200 OK and writes the .js file to `stages/design/artifacts/pwn.js`.

## Recommended fix

Two layers (do BOTH for proper defence-in-depth):

1. **Extension blocklist (immediate)** — add `.js`, `.css`, `.htc`, `.hta`, `.htaccess`, `.json` (when served as application/json it's not script-executable but is exfiltrable; lower priority) to `BLOCKED_EXTENSIONS`. The minimum to close R-01/R-02 is `.js` and `.css`.

2. **Invert `serveFile`'s MIME map (the V-01 fix #2 deferred to unit-04)** — only `.png`, `.jpg/.jpeg`, `.gif`, `.webp`, `.pdf`, `.txt`, `.md`, `.json` render with their MIME; everything else falls through to `application/octet-stream` + `Content-Disposition: attachment`. Without this, every new browser-renderable extension we forget becomes a finding.

The unit spec deferred #2 to unit-04 ASSESSMENTS.md residual risk, but the unit-04 deferral assumed the upload-side allowlist closed the primary vector. R-01/R-02 prove the allowlist alone does NOT close the class — at minimum, extend `BLOCKED_EXTENSIONS` here in unit-01.

## Acceptance

- `BLOCKED_EXTENSIONS` includes `.js` and `.css` (and ideally `.htc`, `.hta`).
- The R-01 PoC test (`red-team-unit-01-upload-bypass.test.mjs`) is INVERTED to assert 415 rejection (instead of 200 acceptance) and continues passing — flip the assertion when fixing.
- New regression test in `packages/haiku/test/upload-routes.test.mjs` modeled on the existing `.html` rejection test, parameterised over `.js` and `.css` with `application/octet-stream` MIME.
