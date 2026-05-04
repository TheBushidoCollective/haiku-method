---
title: >-
  Naming convention drift: ALLOWED_MIMES_KNOWLEDGE and
  ALLOWED_MIMES_STAGE_OUTPUT are duplicated identical sets
status: rejected
origin: adversarial-review
author: architecture (from development)
author_type: agent
created_at: '2026-05-03T11:05:44Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 0
triaged_at: '2026-05-03T11:05:44Z'
resolution: null
replies: []
---

## Finding

`packages/haiku/src/http/upload-routes.ts:153-176` defines two `ReadonlySet<string>` constants — `ALLOWED_MIMES_STAGE_OUTPUT` and `ALLOWED_MIMES_KNOWLEDGE` — with identical contents:

```ts
const ALLOWED_MIMES_STAGE_OUTPUT: ReadonlySet<string> = new Set([
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf", "text/plain", "text/markdown", "application/json",
])

const ALLOWED_MIMES_KNOWLEDGE: ReadonlySet<string> = new Set([
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf", "text/plain", "text/markdown", "application/json",
])
```

The comment on the second set says "same allowlist as stage-output" — the duplication is intentional but the abstraction is wrong. This is a "premature parallelism" smell: two names suggest two different policies, but the set membership check is one policy.

## Why this matters

- A future change to one route's allowlist (e.g. adding `text/csv` for knowledge uploads only) will be made at the wrong site, then mirrored to the other set "for symmetry" — exactly because the names suggest they should diverge.
- The V-01/V-02 quality gate `v01-v02-allowed-mimes-defined` greps for `ALLOWED_MIMES`, so it fires on either name. There's no gate enforcement reason to keep them separate.
- The `ASSESSMENTS.md` §2 V-02 row says "`ALLOWED_MIMES_STAGE_OUTPUT` + `ALLOWED_MIMES_KNOWLEDGE` defined per route in commit `3867608a6`" — the per-route framing is post-hoc justification for what is in fact one allowlist.

## Suggested remediation

Collapse to one constant — `UPLOAD_ALLOWED_MIMES` (or whatever name fits the codebase's existing style for upload-side constants). Both routes reference it. If a real divergence ever appears (a knowledge-only or stage-output-only MIME), split at that point with a clear name carrying the reason — `KNOWLEDGE_ONLY_MIMES` extending the base set, etc.

The same pattern applies to the V-01/V-02 violation messages (lines 537 and 872) — both route handlers emit identical `Files with extensions ${...}` text. Extract to a single helper.

## Source references

- `packages/haiku/src/http/upload-routes.ts:153-176` — the duplicate constants
- `packages/haiku/src/http/upload-routes.ts:533-552` — first call site (stage-output)
- `packages/haiku/src/http/upload-routes.ts:866-887` — second call site (knowledge)

---

**Rejection reason:** Premature optimization concern, not a security finding. ALLOWED_MIMES_STAGE_OUTPUT and ALLOWED_MIMES_KNOWLEDGE are intentionally separate per-route allowlists; their current overlap reflects today's threat model but the routes have distinct policy ownership (knowledge uploads vs stage-output replacements). Collapsing into one constant would couple two policies that should evolve independently — when the knowledge surface adds .pdf / .csv / .xlsx for research uploads, stage-output won't follow. The architecture review lens is right to flag this kind of duplication generally; in this specific case the separation is intentional. No fix.
