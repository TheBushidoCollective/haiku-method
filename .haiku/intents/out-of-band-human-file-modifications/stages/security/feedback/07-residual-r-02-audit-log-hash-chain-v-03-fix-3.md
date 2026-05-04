---
title: 'Residual R-02: Audit-log hash-chain (V-03 fix #3)'
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-05-03T09:04:47Z'
iteration: 1
visit: 1
source_ref: stages/security/artifacts/ASSESSMENTS.md#r-2
closed_by: 'deferred-to-followup-iteration:audit-log-hash-chain'
bolt: 0
triaged_at: '2026-05-03T09:04:47Z'
resolution: stage_revisit
replies: []
---

## Deferred residual risk — audit-log hash-chain

**Owning vulns**: V-03 (integrity-on-the-log-itself defense, separate from attribution binding).

**Why deferred**: V-03 attribution is bound (Option B `claimed_author_id` rename, commit `399c2ee13`). Hash-chaining the log lines is a separate, additive control. Current state ("attribution is self-reported and the field name says so") is integrity-honest; hash-chain is the next maturity step.

**Severity if unfixed**: Medium (attacker who can write to disk can rewrite prior log lines without detection). Today: Low (intent-directory write access is already a meaningful breach).

**Recommended target iteration**: Next security wave.

**Scope**:
1. Add `prev_hash` field to every line in `write-audit.jsonl` and `action-log.jsonl` — SHA-256 of the prior line's canonical JSON serialization.
2. Tamper-detection on read: every reader recomputes the chain when loading; mismatched hash surfaces a structured `audit_log_corrupt` error rather than silently returning rewritten data.
3. Migration: existing log files' first line gets a sentinel `prev_hash: null`; subsequent appends honor the chain. Old lines are read-honest (not retroactively chained).

**Affected components**:
- `packages/haiku/src/orchestrator/workflow/write-audit.ts` (`appendWriteAudit`)
- `packages/haiku/src/orchestrator/workflow/action-log.ts` (`appendActionLog`)
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` (consumer chain validation)

**Source**: ASSESSMENTS.md §4 R-2; VULN-REPORT.md V-03 fix #3.
