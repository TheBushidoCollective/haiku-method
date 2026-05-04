---
title: >-
  http/path-safety.ts misnamed and over-scoped: now mixes Fastify-route helpers
  with pure-fs primitives
status: rejected
origin: adversarial-review
author: architecture (from development)
author_type: agent
created_at: '2026-05-03T11:07:20Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 0
triaged_at: '2026-05-03T11:07:20Z'
resolution: null
replies: []
---

## Finding

`packages/haiku/src/http/path-safety.ts` on the `main` branch is a focused HTTP-route helper module: it owns `resolvePathSafe` (path-traversal defence), `rejectUnsafePathParam` (Fastify-shaped 403 sender), `serveFile`, and `serveUnderRoot` — all of which depend on `FastifyReply` and `FileServeParamsSchema`. Its responsibility is "path-traversal defence on file-serving routes."

The security stage's V-04 fix added two pure-fs primitives to the same file:

- `safeMkdirAndRename(intentRoot, parentDir, tmpPath, destPath)` — `fs.lstatSync`/`mkdirSync`/`renameSync` only; no Fastify, no HTTP.
- `cleanupTempFile(tmpPath)` — wraps `unlinkSync`.

These now share a module with `serveFile(reply: FastifyReply, realPath: string)` despite having no overlap in dependencies, no shared abstraction, and no shared call site. The module's filename (`path-safety.ts`) and its location (`http/`) both signal "HTTP path safety," but it now owns the V-04 race-free atomic-rename primitive that is consumed by `state-tools.ts` and `tools/orchestrator/haiku_human_write.ts` — neither of which are HTTP code (see FB-23 for the layering violation).

The module's own header comment captures the confusion:

```
// http/path-safety.ts — Filesystem path-traversal defence + safe file
// serving. Used by every asset-serve route ...
//
// V-04 (Symlink TOCTOU defence): see `safeMkdirAndRename` below. Node's
// path-based APIs ... close the legacy `mkdirSync(recursive: true)`
// follow-symlink trap.
```

"asset-serve route" + "Node's path-based APIs" — two scopes, one file.

## Why this matters

Naming conventions match the codebase, not the agent's preference (mandate). The codebase's `http/` namespace is documented as "the SPA backend" (ARCHITECTURE.md §1.1, §1.5). A non-HTTP primitive in `http/` is namespace-mismatch by the codebase's own rules. Future engineers searching for "where do we do safe filesystem writes" will not look under `http/`; they will reinvent the helper, and the next V-04 review will find both copies.

## Suggested remediation

Split the file along its actual responsibility boundary:

- Keep `http/path-safety.ts` for Fastify-shaped helpers: `resolvePathSafe`, `rejectUnsafePathParam`, `serveFile`, `serveUnderRoot`. Restore its main-branch shape.
- Move `safeMkdirAndRename`, `cleanupTempFile`, the `SafeMkdirAndRenameResult` type, and the V-04 helper documentation to `state/safe-write.ts` (a sibling of `state/shared.ts`).

Both `http/upload-routes.ts` and `state-tools.ts` / `tools/orchestrator/haiku_human_write.ts` import from the new shared location. The V-04 quality gate `v04-shared-safe-mkdir-helper` (which currently greps `http/path-safety.ts`) updates to grep the new location — gates follow the implementation, not the other way around.

This is the same fix shape as FB-23 (state-tools→http inversion) and resolves it concurrently — both findings collapse to "the V-04 helper landed in the wrong module."

## Source references

- `packages/haiku/src/http/path-safety.ts:1-39` — header comment showing the dual-scope mismatch
- `packages/haiku/src/http/path-safety.ts:140-417` — `safeMkdirAndRename` + `cleanupTempFile`
- `git show main:packages/haiku/src/http/path-safety.ts` — pre-security-stage shape (HTTP-only)
- `.haiku/intents/out-of-band-human-file-modifications/knowledge/ARCHITECTURE.md:62,395` — `state/` namespace + http-is-downstream rule

---

**Rejection reason:** Out of intent scope. Renaming http/path-safety.ts and re-homing its mixed responsibilities is a project-wide refactor that would touch every importer (haiku_human_write.ts, upload-routes.ts, state-tools.ts, drift-baseline.ts) plus invalidate cross-references in test names, fix-chain commits, and the threat-model artifacts that just landed. The security stage's job is the V-01..V-11 mitigations; module reorganization for taxonomy clarity belongs in a follow-on architecture-cleanup intent. Will note the misnaming in ASSESSMENTS.md residual register so it's tracked.
