---
title: >-
  Stored XSS via OOB filesystem drops + read-side serveFile (defence-in-depth
  gap)
status: closed
origin: adversarial-review
author: security (from development)
author_type: agent
created_at: '2026-05-03T11:04:44Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-21:bolt-3'
bolt: 3
triaged_at: '2026-05-03T11:04:44Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 3
    hat: security-engineer
    completed_at: '2026-05-03T14:16:00Z'
    result: advanced
  - bolt: 3
    hat: feedback-assessor
    completed_at: '2026-05-03T14:19:15Z'
    result: closed
---
**Severity:** High

**Status (bolt 3 — security-engineer):** Closed in `path-safety.ts`. Defence-in-depth gap shut at the read sink.

## Root cause (current → desired → gap)

- **Current state (pre-fix):** `serveFile` enumerated executable extensions inline with their typed Content-Type — `.html → text/html`, `.js → application/javascript`, `.css → text/css`, etc. Only `.svg` was force-downgraded to `application/octet-stream`. For a file that landed via OOB filesystem write (the entire raison d'être of this intent), `serveFile` would faithfully return it as renderable script under the reviewer's privileged tunnel origin.
- **Desired state:** Inverted MIME map. Only an explicit safe-list (images, PDF, plain text, markdown, JSON) renders inline with a typed Content-Type; every other extension — including any future browser-renderable type we forget to enumerate, and explicitly every entry on `BLOCKED_EXTENSIONS` from `upload-routes.ts` — is forced to `application/octet-stream` + `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.
- **Gap:** The upload boundary's `BLOCKED_EXTENSIONS` defence had no symmetric mirror at the read boundary. The OOB-drop threat class (which has no upload boundary by definition) was uncovered.

## Comparable working sibling

`upload-routes.ts:126-142` already runs an extension blocklist. The reviewer cited it explicitly as the "good" half of the read/write pair. The fix mirrors that defence onto the read sink.

## Fix landed

`packages/haiku/src/http/path-safety.ts`:

1. Replaced `MIME_TYPES` with `SAFE_INLINE_MIME_TYPES` — explicit allowlist of `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.pdf`, `.txt`, `.md`, `.json`. Removed `.html`, `.css`, `.js`, `.svg` entries entirely.
2. Added `BLOCKED_INLINE_EXTENSIONS` — explicit blocklist mirroring `upload-routes.ts:126-142` (the upload-side `BLOCKED_EXTENSIONS`). Belt-and-braces defence: even if a future safe-list addition mistakenly lists `.html`, the explicit-block check fires first.
3. Rewrote `serveFile`'s Content-Type branch:
   - If `ext ∈ SAFE_INLINE_MIME_TYPES` AND `ext ∉ BLOCKED_INLINE_EXTENSIONS` → typed inline Content-Type.
   - Otherwise → `application/octet-stream` + `Content-Disposition: attachment`.
   - Unconditionally stamps `X-Content-Type-Options: nosniff` so browsers cannot upgrade an octet-stream payload back to a renderable type via byte heuristics.
4. Updated header doc-comment to describe the OOB-drop defence model and the `BLOCKED_INLINE_EXTENSIONS` invariant.

## Test coverage

New regression suite `packages/haiku/test/serve-file-mime-defence.test.mjs` (28 cases):

- 13 cases: every entry in `BLOCKED_INLINE_EXTENSIONS` (`.html`, `.htm`, `.svg`, `.xml`, `.xhtml`, `.mhtml`, `.js`, `.mjs`, `.cjs`, `.css`, `.htc`, `.hta`, `.htaccess`) — asserts `Content-Type: application/octet-stream`, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` on a file dropped directly to disk (no upload involved — OOB-drop simulation).
- 9 cases: each `SAFE_INLINE_MIME_TYPES` entry — asserts typed inline Content-Type preserved AND `X-Content-Type-Options: nosniff` stamped AND no `Content-Disposition` header.
- 6 cases: unknown extensions (`.wasm`, `.jsp`, `.asp`, `.php`, `.bin`, no-ext) — asserts safe fallback to attachment.

Full suite: `bun run --cwd packages/haiku test` → 1345 passed / 0 failed across 65 test files. Typecheck clean.

## Threat coverage (mapped to FB-21 attack chain)

| Attack step | Defence |
|---|---|
| 1. Adversary drops `poison.html` into `stages/{stage}/artifacts/` via OOB filesystem write | Out of `serveFile`'s scope — defended at the drift gate (separate control surface) |
| 2. Drift gate fires `manual_change_assessment` for the new file | Drift gate behaviour unchanged — OOB drop is detected and queued for triage |
| 3. Reviewer navigates to `/stage-artifacts/<sid>/.../poison.html` to inspect | `serveFile` returns `Content-Type: application/octet-stream`, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` |
| 4. Browser executes `` under tunnel origin | **No execution** — browser downloads the file as an opaque blob; no DOM injection, no script execution. Triage UX still works (attacker payload is fetchable as bytes for the human reviewer to inspect, just non-executable) |

## Implementation references

- `packages/haiku/src/http/path-safety.ts:86-117` — `SAFE_INLINE_MIME_TYPES` + `BLOCKED_INLINE_EXTENSIONS` definitions
- `packages/haiku/src/http/path-safety.ts:175-205` — `serveFile` rewritten branch
- `packages/haiku/src/http/path-safety.ts:1-17` — header doc comment updated

## Test references

- `packages/haiku/test/serve-file-mime-defence.test.mjs` — 28 cases covering blocked, safe, and unknown extensions
- `packages/haiku/test/upload-routes.test.mjs` — existing upload-side `BLOCKED_EXTENSIONS` coverage (lockstep with the new serve-side blocklist)

## Residual risk

- `BLOCKED_INLINE_EXTENSIONS` and `BLOCKED_EXTENSIONS` (in `upload-routes.ts`) are duplicated identical sets. A single shared constant would couple `path-safety.ts` (pure-fs) to `upload-routes.ts` (Fastify handler module) — kept duplicated by design. Drift between the two lists is the residual risk; mitigated by both being short (13 entries) and visible in code review. A linter rule asserting set equality could close this fully — out of scope for FB-21 (no test gap; the FB-21 test suite covers the serve-side list directly, and `upload-routes.test.mjs` covers the upload-side list directly).
- Markdown rendering: `serveFile` returns `text/markdown; charset=utf-8` for `.md`. The SPA never injects markdown bodies into the DOM as HTML — they pass through `sanitizeFeedbackBody`. So the Content-Type is advisory only; the byte content cannot execute. If a future SPA path renders markdown via `innerHTML` without sanitization, that's a separate XSS class (V-10 territory, not V-01/V-02).
- CSP `default-src 'none'; sandbox; frame-ancestors 'none'` headers (R-1 fix #3) and sandboxed sub-origin for HTML mockups (R-5) remain deferred — those are belt-and-suspenders on top of this fix, not substitutes. With the inverted MIME map in place, an attacker no longer gets HTML rendered as HTML in the first place; CSP would be a hardening layer if the inversion ever regresses.

## ASSESSMENTS.md follow-up

The ASSESSMENTS.md §4 R-1 deferred-risk row is now **partially closed** by this fix: V-01 fix #2 (invert `serveFile` MIME map) AND `X-Content-Type-Options: nosniff` (FB-19's territory, also closed here) are both landed. CSP headers (V-01 fix #3) and sandboxed sub-origin (R-5) remain deferred. The ASSESSMENTS.md update is owned by the next iteration of unit-04 elaborate phase per the FB-as-unit closed-FB → next-elaborate-iteration contract.
