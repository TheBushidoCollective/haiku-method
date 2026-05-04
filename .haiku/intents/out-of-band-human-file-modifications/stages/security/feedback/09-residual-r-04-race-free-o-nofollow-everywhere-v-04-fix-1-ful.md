---
title: 'Residual R-04: Race-free O_NOFOLLOW-everywhere (V-04 fix #1 full migration)'
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-05-03T09:05:23Z'
iteration: 1
visit: 1
source_ref: stages/security/artifacts/ASSESSMENTS.md#r-4
closed_by: 'deferred-to-followup-iteration:race-free-openat'
bolt: 0
triaged_at: '2026-05-03T09:05:23Z'
resolution: stage_revisit
replies: []
---

## Deferred residual risk — race-free O_NOFOLLOW-everywhere

**Owning vulns**: V-04.

**Why deferred**: Unit-03's `safeMkdirAndRename` helper (commit `573c91da1`) closes the single-shot easy case via `realpathSync.startsWith(intentRoot)` re-check after `mkdirSync` and before `rename`. A determined attacker with concurrent intent-directory write access who can keep flipping a symlink in a tight loop can still race the window. Full migration to `openat`/`renameat`-style semantics is the only race-free fix but is a bigger lift — Node's fs API does not expose `openat` directly.

**Severity if unfixed**: Medium (TOCTOU race remains for an attacker with concurrent write access). Today: accepted residual — concurrent intent-directory write access is already a meaningful breach (see THREAT-MODEL.md §2.2).

**Recommended target iteration**: Next security wave; needs FFI / Node-native investigation up front.

**Scope**:
1. Investigate `openat` / `renameat` exposure paths in Node:
   - `process.binding('fs')` (private API, brittle)
   - `node-ffi-napi` wrapper (adds dependency surface)
   - Per-segment `lstat` walk that fails on symlink (race-prone but pure-JS — same class of fix as today's helper, doesn't really close the gap)
2. If FFI is acceptable, migrate `safeMkdirAndRename` to use `openat(parent_fd, basename, O_NOFOLLOW)` so the file descriptor is bound to the kernel inode the validator just inspected.
3. Both call sites (`state-tools.ts` `haiku_human_write` + `upload-routes.ts:413-454`) re-route through the new helper.
4. Multi-tick concurrent symlink-swap test asserts the write fails.

**Affected components**:
- `packages/haiku/src/http/path-safety.ts` (`safeMkdirAndRename`)
- `packages/haiku/src/state-tools.ts` (`haiku_human_write` mkdir-then-rename path)
- `packages/haiku/src/http/upload-routes.ts:413-454` (SPA upload mkdir-then-rename)

**Source**: ASSESSMENTS.md §4 R-4; VULN-REPORT.md V-04 fix #1.
