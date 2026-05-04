---
title: >-
  Audit-log atomicity claim broken by unbounded rationale/path/dirs_created
  fields
status: closed
origin: adversarial-review
author: security (from development)
author_type: agent
created_at: '2026-05-03T11:05:28Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-28:bolt-3'
bolt: 3
triaged_at: '2026-05-03T11:05:28Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 3
    hat: security-engineer
    completed_at: '2026-05-03T14:21:37Z'
    result: advanced
  - bolt: 3
    hat: feedback-assessor
    completed_at: '2026-05-03T14:25:16Z'
    result: closed
---
**Severity:** Medium

**Summary:** `appendJsonlLine` / `appendWriteAudit` / `appendActionLogEntry` claim atomic concurrent appends via "POSIX guarantees that write()s ≤ PIPE_BUF (4 KiB on most platforms) to an O_APPEND file are atomic." But several record fields are unbounded, so a single record will frequently exceed PIPE_BUF — and on macOS PIPE_BUF is **512 bytes**, not 4 KiB. The contract is silently wrong on macOS for almost every record, and wrong on Linux for the long-rationale case.

**Where:**
- Atomicity claim: `packages/haiku/src/orchestrator/workflow/write-audit.ts:131-163, 165-182` and `packages/haiku/src/orchestrator/workflow/action-log.ts:36-73`.
- Unbounded fields:
  - `WriteAuditRecord.rationale` (`haiku_human_write.ts:413` — no cap).
  - `WriteAuditRecord.user_instruction_excerpt` capped to 200+`...` chars by `truncateInstruction` — OK, but the **other** fields aren't.
  - `WriteAuditRecord.dirs_created: string[]` (`haiku_human_write.ts:670-683`) — proportional to depth of newly-created directory chain; many entries push the line size over PIPE_BUF.
  - `WriteAuditRecord.path` — bounded by filesystem PATH_MAX (~4 KiB on Linux, 1 KiB on macOS), already exceeds macOS PIPE_BUF on its own.
  - `claimed_author_id` / `human_author_id` — unbounded on the MCP path (see separate FB on `attribute_to_user` validation gap).

**Concurrent writers:**
1. SPA upload route (`upload-routes.ts:726, 729, 1027, 1030`).
2. MCP tool `haiku_human_write` (`haiku_human_write.ts:795, 838`).
3. Drift baseline / V-11 markers (`drift-baseline.ts:1218, 1241`).

All three append to the **same** `write-audit.jsonl` and `action-log.jsonl` per intent. With concurrent ticks + concurrent SPA uploads + concurrent agent calls, write interleaving will produce malformed JSON lines.

**Consequence:** `readActionLogForTick` (`action-log.ts:97-109`) silently swallows JSON.parse failures (`catch { /* skip */ }`). Lost entries → drift-detection gate misclassifies authorship (a `human-via-mcp` write gets attributed `human-implicit` because its action-log entry vanished). The whole "trust + audit" model in ARCHITECTURE.md §6.1-§6.3 is built on the integrity of these logs.

**Spirit of the mandate:** "Input validation at system boundaries" + "no insecure defaults" — the atomicity claim is an insecure default (silently wrong on macOS for nearly every record, wrong everywhere for long-rationale). It also feeds the audit-log poisoning class because a malformed line is silently dropped rather than alarmed.

**Suggested fix:**
- Stop relying on PIPE_BUF for atomicity. Use one of: (a) a userspace lock (e.g. `proper-lockfile` against `<log>.lock`), (b) a single-writer queue inside the process plus advisory file locking for cross-process writers, or (c) per-process per-tick rotation files that get coalesced offline.
- Cap every variable-length field on the record (rationale ≤ 4 KB, claimed_author_id ≤ 128, dirs_created length cap, path bounded — all already feasible).
- Fail-closed on JSONL parse errors in the consumer: a malformed line is a tampering signal, not a "skip and continue."

**Why in scope:** The mandate explicitly calls out "no insecure defaults" and the audit log is the security control of record for human-via-mcp attribution; lying about its atomicity is a security-meaningful misconfiguration.
