---
title: 'Residual R-01: Serve-side hardening (V-01/V-02 fix #2/#3)'
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-05-03T09:04:33Z'
iteration: 1
visit: 1
source_ref: stages/security/artifacts/ASSESSMENTS.md#r-1
closed_by: 'deferred-to-followup-iteration:serve-side-hardening'
bolt: 0
triaged_at: '2026-05-03T09:04:33Z'
resolution: stage_revisit
replies: []
---

## Deferred residual risk — serve-side hardening

**Owning vulns**: V-01 (knowledge upload XSS), V-02 (stage-output upload XSS).

**Why deferred**: Upload-side allowlist (commits `3867608a6`, `bfa4b7c91`) closes the primary attack vector. Serve-side hardening is the second-line defense if a future allowlist regression slips through. First-line is in place; second can land in a follow-up wave.

**Severity if unfixed**: Medium when an upload-side bypass slips through. Today: Low (no known bypass).

**Recommended target iteration**: Next security wave (security pass 2). Group with R-5 (sandboxed sub-origin) — same `serveFile` + `file-serve.ts` + `path-safety.ts` surface.

**Scope**:
1. Invert `serveFile` MIME map: only known-safe types render inline; everything else → `application/octet-stream` + `Content-Disposition: attachment`. Today the carve-out only covers `.svg`.
2. Stamp `Content-Security-Policy: default-src 'none'; sandbox; frame-ancestors 'none'` on every served knowledge artifact regardless of type — the SPA never needs scripted execution from these files.
3. Co-locate with sandboxed sub-origin work (R-5) for HTML-mockup support.

**Affected components**:
- `packages/haiku/src/http/path-safety.ts` (`serveFile`, `MIME_TYPES`)
- `packages/haiku/src/http/file-serve.ts` (`/files/:sessionId/*`, `/stage-artifacts/:sessionId/*`)

**Source**: ASSESSMENTS.md §4 R-1.
