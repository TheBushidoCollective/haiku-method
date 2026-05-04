---
title: >-
  Architecture violation: state-tools.ts and tools/orchestrator imports from
  http/
status: closed
origin: adversarial-review
author: architecture (from development)
author_type: agent
created_at: '2026-05-03T11:05:04Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-23:bolt-3'
bolt: 3
triaged_at: '2026-05-03T11:05:04Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 3
    hat: security-engineer
    completed_at: '2026-05-03T14:15:53Z'
    result: advanced
  - bolt: 3
    hat: feedback-assessor
    completed_at: '2026-05-03T14:20:10Z'
    result: closed
---
## Finding

The development-stage `ARCHITECTURE.md` (at `.haiku/intents/out-of-band-human-file-modifications/knowledge/ARCHITECTURE.md:393-395`) states the dependency direction rule explicitly:

> - `packages/haiku/src/orchestrator/workflow/` MAY import from `state-tools.ts`, `state/shared.ts`, and other workflow-internal modules. **It MUST NOT import from `http/`** (the HTTP module is a downstream consumer of orchestrator state, not the other way around).
> - `packages/haiku/src/http/` is a downstream consumer of everything else. **Nothing imports back into `http/`**.

The security stage's fix units violate this rule in three places:

1. **`packages/haiku/src/state-tools.ts:26`**
   ```ts
   import { sanitizeFeedbackBody } from "./http/feedback-sanitize.js"
   ```
2. **`packages/haiku/src/state-tools.ts:36`**
   ```ts
   export { safeMkdirAndRename } from "./http/path-safety.js"
   ```
3. **`packages/haiku/src/tools/orchestrator/haiku_human_write.ts:44`**
   ```ts
   import { cleanupTempFile, safeMkdirAndRename } from "../../http/path-safety.js"
   ```

`state-tools.ts` is the central resource-tool surface that workflow handlers depend on transitively (via `getIntentScopeTickCounter`, `intentDir`, `isIntentArchived`, etc.). Pulling helpers out of `http/` into `state-tools.ts` collapses the layering: the workflow engine is now indirectly coupled to the SPA backend's module tree.

## Why this matters

- The architecture document binds these directions specifically because `http/` is the SPA backend (a "downstream consumer"). Reversing the direction means a future change to a route file (e.g. moving `path-safety.ts` to a request-scoped helper) silently breaks the MCP tool surface.
- The two helpers landed in the wrong module. `safeMkdirAndRename`, `cleanupTempFile`, and `sanitizeFeedbackBody` are pure-fs / pure-string primitives — they have nothing to do with Fastify, HTTP, or routes. The fact that they were *first needed* by `upload-routes.ts` does not make them HTTP code.
- The "spirit" of the rule (lens, not checklist): no code outside `http/` should care that `http/` exists. Today, `state-tools.ts` knows about it.

## Suggested remediation

Move the shared helpers out of `http/` into a non-HTTP location consistent with the §1.1 module map:

- `safeMkdirAndRename` + `cleanupTempFile` → a new `packages/haiku/src/state/safe-write.ts` (or fold into `state-tools.ts` directly since it already exports `getIntentScopeTickCounter` and similar fs primitives).
- `sanitizeFeedbackBody` → `packages/haiku/src/state/sanitize-feedback.ts` (or fold into `state-tools.ts` next to `writeFeedbackFile`).

Then `http/upload-routes.ts`, `http/feedback-api.ts`, `state-tools.ts`, and `tools/orchestrator/haiku_human_write.ts` all import from the new shared location, and `http/path-safety.ts` shrinks back to its main-branch shape (Fastify-shaped helpers only).

## Source references

- `.haiku/intents/out-of-band-human-file-modifications/knowledge/ARCHITECTURE.md:393-395` — the rule
- `packages/haiku/src/state-tools.ts:26,36` — first violation
- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:44` — second violation
- `git show main:packages/haiku/src/http/path-safety.ts` — pre-security-stage shape (FastifyReply-shaped helpers only; `safeMkdirAndRename` and `cleanupTempFile` did not exist)
