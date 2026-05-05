---
title: Circular dependency between http/csrf.ts and http/auth.ts
status: closed
origin: adversarial-review
author: architecture (from development)
author_type: agent
created_at: '2026-05-03T11:05:24Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-27:bolt-3'
bolt: 3
triaged_at: '2026-05-03T11:05:24Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 3
    hat: security-engineer
    completed_at: '2026-05-03T14:21:32Z'
    result: advanced
  - bolt: 3
    hat: feedback-assessor
    completed_at: '2026-05-03T14:24:35Z'
    result: closed
---
## Finding

`packages/haiku/src/http/csrf.ts` and `packages/haiku/src/http/auth.ts` form a circular import:

- `http/csrf.ts:61` — `import { extractTunnelToken } from "./auth.js"`
- `http/auth.ts:133-151` — six re-exports back from `./csrf.js`:
  ```ts
  export { CSRF_QUERY_PARAM_TOKEN_DISALLOWED_REASON } from "./csrf.js"
  export { isOriginAllowed as checkOrigin } from "./csrf.js"
  export { csrfPreHandler as requireCsrfNonce } from "./csrf.js"
  export { mintCsrfNonce, getCsrfNonce } from "./csrf.js"
  export { CSRF_NONCE_HEADER } from "./csrf.js"
  ```

ESM handles this at runtime (the symbols resolve in evaluation order), so it doesn't crash — but it's a real circular dependency and the rationale recorded in the file makes the architectural smell explicit:

> Re-export the layer chokepoints from auth.ts so the auth surface is the single discoverable entry point for everything "is this request allowed to mutate?" — bearer-JWT auth (this file) AND the three CSRF layers (csrf.ts). **Quality-gate static-analysis greps look here because auth + csrf are conceptually one boundary.**

## Why this matters

The re-exports exist to satisfy the V-08 quality gates' grep predicates (e.g. `v08-query-param-token-rejected-on-mutating-routes` greps `auth.ts`). Verification:

```
grep -rn "checkOrigin\|requireCsrfNonce" packages/haiku/src/
```

returns ZERO consumers of the re-exported aliases — they are dead code whose only purpose is to make a static-analysis grep succeed. This is the "implementation shaped to pass the gate" anti-pattern: the gate's text-pattern contract is satisfied at the wrong file.

The architectural correction is one of two paths, neither of which is "leave the circular dep + dead re-exports in place":

**Option A** — fix the gates. Update `unit-04-threat-model-and-assessments.md` quality_gates so the V-08 greps point at `http/csrf.ts` (where the code actually lives), and delete the auth.ts re-export block. `csrf.ts` becomes the discoverable entry point. ASSESSMENTS.md §2 already notes "the actual three-layer defense lives in the new `http/csrf.ts` module" — the gates should point there.

**Option B** — collapse the modules. If "auth + csrf are conceptually one boundary" (per the auth.ts comment), merge `csrf.ts` into `auth.ts`. The circular dep disappears because there's only one module.

Today's state — keep the cycle, keep the dead re-exports, document why — encodes the gate's mistake in the source tree forever.

## Source references

- `packages/haiku/src/http/csrf.ts:61` — circular-import edge
- `packages/haiku/src/http/auth.ts:120-151` — six re-exports plus the explanatory comment
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md:64` — V-08 row admits the gate file moved during implementation ("original gate pointed at `auth.ts`; the actual three-layer defense lives in the new `http/csrf.ts` module")
- `packages/haiku/src/http/feedback-api.ts:56` — same shape: gate `v10-feedback-body-sanitized` greps `feedback-api.ts` but the implementation lives in the new `feedback-sanitize.ts` module (admitted in ASSESSMENTS.md §2 row V-10)
