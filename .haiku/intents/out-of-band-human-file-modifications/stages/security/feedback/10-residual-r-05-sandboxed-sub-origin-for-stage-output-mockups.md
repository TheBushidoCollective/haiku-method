---
title: 'Residual R-05: Sandboxed sub-origin for stage-output mockups (V-02 follow-up)'
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-05-03T09:05:42Z'
iteration: 1
visit: 1
source_ref: stages/security/artifacts/ASSESSMENTS.md#r-5
closed_by: 'deferred-to-followup-iteration:sandboxed-sub-origin'
bolt: 0
triaged_at: '2026-05-03T09:05:42Z'
resolution: stage_revisit
replies: []
---

## Deferred residual risk — sandboxed sub-origin for stage-output mockups

**Owning vulns**: V-02 (HTML-mockup product use case).

**Why deferred**: Stage outputs are explicitly described as the surface reviewers use to swap in figma/HTML/image artifacts mid-review. Current allowlist forbids `.html` entirely (R-01 closure on commit `bfa4b7c91`), which is safe but blocks the legitimate HTML-mockup product use case. The proper fix is a sandboxed sub-origin so script execution in a mockup cannot reach the tunnel-origin's session token. Implementation requires localtunnel sub-origin support (or a proxy layer) — a deployment-topology change.

**Severity if unfixed**: Low today (HTML-mockup feature blocked, no exploitable surface). Medium when re-enabled without sandbox: every HTML mockup becomes an XSS vector.

**Recommended target iteration**: Co-locate with R-1 (serve-side hardening) in next security wave; gated on sub-origin infrastructure.

**Scope**:
1. Provision a sandboxed sub-origin for stage-output rendering (cookie-isolated subdomain, distinct from the tunnel origin that holds the SPA session JWT).
2. Configure sub-origin with: `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Opener-Policy: same-origin`, `Sec-Fetch-Site` validation rejecting same-origin requests (so the SPA can iframe the mockup but the mockup cannot reach back).
3. Allow `.html` / `.htm` / `.xhtml` extensions on the stage-output upload route ONLY when the SPA serves them through the sub-origin route. Knowledge route remains lock-down.
4. Localtunnel currently exposes one URL per session — investigation needed: is wildcard subdomain support available? If not, the sub-origin must come from a separate tunnel.

**Affected components**:
- `packages/haiku/src/http/upload-routes.ts` (stage-output extension allowlist relaxation, conditional on sub-origin route)
- `packages/haiku/src/http/file-serve.ts` (new sub-origin-only `/stage-mockup/:sid/*` route)
- `packages/haiku/src/tunnel.ts` (sub-origin / wildcard subdomain provisioning)
- SPA renderer (iframe stage-mockup route through sandbox attribute)

**Source**: ASSESSMENTS.md §4 R-5; VULN-REPORT.md V-02 fix follow-up.
