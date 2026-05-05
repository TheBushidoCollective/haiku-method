---
title: >-
  No X-Content-Type-Options: nosniff on serveFile — undocumented browser-sniff
  XSS surface
status: rejected
origin: adversarial-review
author: mitigation-effectiveness
author_type: agent
created_at: '2026-05-03T11:04:42Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 0
triaged_at: '2026-05-03T11:04:42Z'
resolution: null
replies: []
---

## Mandate violation

THREAT-MODEL.md §3.4 and §4.5 frame the I-1/I-2 mitigation as a two-layer defense:
1. Upload-side allowlist (`ALLOWED_MIMES_*` + `BLOCKED_EXTENSIONS`) — IN PLACE.
2. Serve-side hardening (`Content-Disposition: attachment` + CSP) — DEFERRED to R-1.

Both threat-model and assessments treat the upload-side allowlist as the load-bearing first line of defense and serve-side as "defense-in-depth for if a future allowlist regression slips through."

But the cheapest serve-side defense — `X-Content-Type-Options: nosniff` — is missing from `serveFile` and not on the deferred list. This is a one-line, zero-infrastructure-cost mitigation that the threat model does not even acknowledge as missing.

```bash
$ grep -rn 'nosniff\|X-Content-Type-Options\|Content-Security-Policy\|X-Frame-Options' \
    packages/haiku/src/
# (zero matches)
```

## Defense-in-depth check (mandate)

The mandate requires "critical threats have multiple layers of mitigation." The threat-model assigns I-1/I-2 (stored XSS in tunnel origin) as one of the most damaging threat classes — token + intent contents exfil. Today the only layer that exists for `image/png` / `application/pdf` / `text/plain` / `text/markdown` / `application/json` content types is **client-side MIME parsing**.

Without `nosniff`:
- `image/png` upload that is actually `<html></html>` (passes the upload allowlist because the server trusts the client-supplied `Content-Type: image/png` and does NOT inspect bytes) → served back with `Content-Type: image/png` → some browsers / older browsers / Edge legacy / proxies that re-sniff for content-type-incorrect pages may render as HTML.
- `application/json` upload of HTML — same story.
- `text/plain` is the canonical sniff trap (legacy IE, content-detection edge cases).

Additionally: `serveFile` has special-cased `.svg` to set `Content-Disposition: attachment` (lines 114-116) — the file specifically calls out browser-sniff trust issues for SVG. The same logic that motivates SVG attachment-only serving applies to the un-defended categories. The fact that this code already reasoned about sniff attacks makes the missing `nosniff` header on every other extension feel inconsistent at best.

## Root cause

The upload allowlist trusts the CLIENT-supplied `Content-Type` AND the filename extension. There is no magic-byte inspection. So "MIME on allowlist + extension not blocked" is satisfied by any byte stream the client wants to upload, with whatever MIME claim they want to attach. The defense rests entirely on the BROWSER respecting the served `Content-Type`. `X-Content-Type-Options: nosniff` is the IETF-standard way to force that respect.

## Concrete fix

In `packages/haiku/src/http/path-safety.ts:102` (`serveFile`), add ONE line:

```ts
reply.header("X-Content-Type-Options", "nosniff")
```

before `reply.send(data)`. Cost: one line. Test: assert the header is present on `/files/`, `/mockups/`, `/wireframe/`, `/stage-artifacts/` responses.

While there: also add `X-Frame-Options: DENY` (or `Content-Security-Policy: frame-ancestors 'none'`) to defang the per-served-file clickjacking + iframe-sandbox-escape variant. These are similarly free.

## Why this is a mandate finding, not an R-1 dupe

R-1 (FB-06) scopes serve-side hardening to "`Content-Disposition: attachment` for non-image/PDF + CSP `default-src 'none'; sandbox`" — a heavier change that depends on figuring out which categories should download vs render. `nosniff` is independent: it has no UX cost (images still render, PDFs still render in-browser), no infrastructure dependency, and works TODAY with the existing allowlist. Deferring it inside R-1 conflates two very different costs.

The threat-model claim "upload-side allowlist closes the primary attack vector" is true ONLY if one assumes the browser respects the served Content-Type. Without nosniff, that assumption is not enforced. This is a spirit-violation of "defense-in-depth: critical threats have multiple layers of mitigation."

## Files / lines

- `packages/haiku/src/http/path-safety.ts:102-125` — `serveFile` body, missing `X-Content-Type-Options` header
- `packages/haiku/src/http/file-serve.ts` — entire file, every route is unprotected
- THREAT-MODEL.md §3.4 I-1/I-2 — claim of "Closed: V-01/V-02 (allowlist + extension blocklist)" is partial
- ASSESSMENTS.md §4 R-1 — should split out `nosniff` as a separate, near-zero-cost residual that should land THIS wave, not next wave

---

**Rejection reason:** Duplicate of FB-21 (security lens, broader scope). Both flag the same root cause: serveFile renders attacker-uploaded content executably. FB-21 covers the full chain (XSS via OOB filesystem drops + read-side serveFile MIME map) and the proper fix (invert MIME map + Content-Security-Policy + Content-Disposition: attachment + nosniff). FB-19 is the narrower nosniff-only restatement. Closing the broader FB-21 closes this. Rejecting to avoid redundant fix-loop dispatch.</reason>
</invoke>
