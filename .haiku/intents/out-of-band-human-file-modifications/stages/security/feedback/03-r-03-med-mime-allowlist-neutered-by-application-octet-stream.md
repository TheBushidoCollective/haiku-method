---
title: 'R-03 (MED): MIME allowlist neutered by application/octet-stream + text/plain'
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-05-03T02:58:29Z'
iteration: 1
visit: 1
source_ref: stages/security/artifacts/RED-TEAM-unit-01.md#finding-r-03
closed_by: 'fix-loop:FB-03:bolt-1'
bolt: 1
triaged_at: '2026-05-03T02:58:29Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T08:30:40Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-05-03T08:39:06Z'
    result: closed
---
## Summary

`ALLOWED_MIMES_KNOWLEDGE` and `ALLOWED_MIMES_STAGE_OUTPUT` both include `application/octet-stream` (and `text/plain`). The client always controls the MIME header, so the allowlist effectively becomes "extension-blocklist OR `application/octet-stream`-bypass". The MIME check stops being a defence layer the moment the extension blocklist misses anything (R-01/R-02 demonstrated).

PoC R-03 in `red-team-unit-01-upload-bypass.test.mjs` shows even `text/markdown` MIME with `.js` extension passes — symmetric inverse of the V-02 fix that rejects `.html` + `text/plain`. The current logic only catches the exact pair `(text/plain, .html)` but not the equally weaponizable `(text/markdown, .js)`.

## Reproduction

```bash
$ npx tsx packages/haiku/test/red-team-unit-01-upload-bypass.test.mjs
  PASS R-03: text/markdown MIME + .js extension also bypasses (MIME-spoof inverse)
```

## Recommended fix

Tighten `ALLOWED_MIMES_KNOWLEDGE` and `ALLOWED_MIMES_STAGE_OUTPUT`:

- **Remove `application/octet-stream`** — designers uploading PDFs/PNGs already send the correct MIME. Tooling paths that send octet-stream should learn to send a real MIME or be migrated to a separate "binary attachment" route with stricter scope.
- **Strict MIME ↔ extension pairing** — when a known-script MIME (`text/html`, `text/css`, `application/javascript`, `image/svg+xml`, `text/xml`, `application/xml`, etc.) is sent with ANY extension, reject. When an "any" MIME (`application/octet-stream` if kept, `text/plain`) is sent, restrict the allowed extensions to a known-safe set (`.txt`, `.md`, `.csv`).

Combined with R-01/R-02's blocklist additions, this restores actual "allowlist" semantics — a payload must EITHER (a) carry a specific safe MIME (image, pdf, json, markdown) AND a matching extension, OR (b) carry octet-stream AND a non-script extension from a positive list. The current "any of these MIMEs OR no script extension" logic is one missing extension away from XSS forever.

## Acceptance

- `application/octet-stream` removed from both allowlists OR gated to a known-safe extension set.
- New regression test: every script-MIME × every extension permutation rejects.
- New regression test: extension allowlist enforces positive-list semantics.
- R-03 PoC test inverted.
