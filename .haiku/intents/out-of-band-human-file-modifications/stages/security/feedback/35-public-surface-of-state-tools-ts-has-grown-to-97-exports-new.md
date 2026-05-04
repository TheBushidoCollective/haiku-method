---
title: >-
  Public surface of state-tools.ts has grown to 97 exports; new V-09/V-05
  helpers compound a god-module
status: closed
origin: adversarial-review
author: architecture (from development)
author_type: agent
created_at: '2026-05-03T11:06:08Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'deferred-to-followup-iteration:state-tools-export-surface-cleanup'
bolt: 0
triaged_at: '2026-05-03T11:06:08Z'
resolution: stage_revisit
replies: []
---

## Finding

`packages/haiku/src/state-tools.ts` exports 97 symbols (verified: `grep -c "^export\\s" packages/haiku/src/state-tools.ts`). The development-stage `ARCHITECTURE.md:90` already acknowledges this as a known concession:

> `state-tools.ts` owns disk-shaped resource MCP tools. This file is large (~10kloc) and is the single point of truth for unit/feedback/knowledge/intent CRUDL. **It is intentionally not split per-resource**: every tool needs the same path-resolution and frontmatter-validation primitives, and putting them in one file keeps the call surface explicit. New resource tools are added here, not in side files.

The security stage adds at least the following NEW public exports:

- `MAX_RATIONALE_BYTES`, `MAX_RATIONALE_EXCERPT_BYTES`, `RationaleCapViolation`, `RationaleCapClassification`, `validateRationaleCaps` (V-09 — rationale caps)
- `readClaimedAuthorId` (V-03 — claim coalescer)
- `getIntentScopeTickCounter` (V-05 — intent-scope tick)
- `isIntentLocked`, `isIntentArchived` (V-06 — gray-matter status helpers)
- `safeMkdirAndRename` (re-exported from `./http/path-safety.js`, see FB-23)

The exemption ARCHITECTURE.md grants is for **resource-shaped MCP tools** (unit/feedback/intent CRUDL). These five categories are not resource MCP tools — they are pure-function primitives (validators, coalescers, counters, status checks, fs helpers).

## Why this matters

The architecture's stated rationale for the god-module — "every tool needs the same path-resolution and frontmatter-validation primitives" — does not extend to V-09 byte-cap validators or V-05 tick counters. Those primitives are consumed by:

- `tools/orchestrator/haiku_classify_drift.ts` (V-09)
- `tools/orchestrator/haiku_human_write.ts` (V-05)
- `http/upload-routes.ts` (V-05, V-06)

…which is *not* the "resource CRUDL tool" set the exemption covers. The pattern of "needed by two callers, dropped into state-tools.ts" makes the file the dumping ground for any new helper, regardless of whether it has anything to do with resource MCP tools.

## Suggested remediation

The five categories above belong in dedicated single-purpose modules (or a new `state/` subdirectory consistent with the existing `state/shared.ts` per ARCHITECTURE.md §1.1):

- `state/rationale-caps.ts` — V-09 byte caps + validator
- `state/audit-id-coalesce.ts` — `readClaimedAuthorId`
- `state/intent-tick-counter.ts` — V-05 intent-scope counter
- `state/intent-status.ts` — V-06 gray-matter helpers (with negative-grep gate intact)
- `state/safe-write.ts` — V-04 `safeMkdirAndRename` (resolves FB-23 too)

`state-tools.ts` keeps its resource-tool surface; everything else moves where the architecture's §1.1 module map already gestures (a `state/` namespace exists for "shared state primitives").

This is "minimal public API" per the mandate: state-tools.ts's surface should not grow with every new helper that happens to be filesystem-shaped.

## Source references

- `packages/haiku/src/state-tools.ts:105-172` — V-09 caps and validator
- `packages/haiku/src/state-tools.ts:2218-2228` — `readClaimedAuthorId`
- `packages/haiku/src/state-tools.ts:2278-2302` — `getIntentScopeTickCounter`
- `packages/haiku/src/state-tools.ts:36` — re-export of `safeMkdirAndRename`
- `.haiku/intents/out-of-band-human-file-modifications/knowledge/ARCHITECTURE.md:90` — the existing exemption (limited to resource CRUDL)
- `.haiku/intents/out-of-band-human-file-modifications/knowledge/ARCHITECTURE.md:62` — existing `state/` namespace
