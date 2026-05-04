---
title: >-
  haiku_human_write rationale field has no size cap — JSONL atomicity assumption
  breaks at >4 KiB
status: closed
origin: adversarial-review
author: mitigation-effectiveness
author_type: agent
created_at: '2026-05-03T11:05:21Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-26:bolt-3'
bolt: 3
triaged_at: '2026-05-03T11:05:21Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 3
    hat: security-engineer
    completed_at: '2026-05-03T14:16:31Z'
    result: advanced
  - bolt: 3
    hat: feedback-assessor
    completed_at: '2026-05-03T14:19:25Z'
    result: closed
---
## Mandate violation

V-09 (rationale bloat / DoS) is documented as closed by the unit-01 fix:

> `MAX_RATIONALE_BYTES = 10 * 1024` and `MAX_RATIONALE_EXCERPT_BYTES = 1024` constants in `state-tools.ts`; `validateRationaleCaps()` helper. Schema-validation rejects oversize rationales BEFORE `DA-NN.json` write.

Verified: `validateRationaleCaps` IS called from `haiku_classify_drift` before write (state-tools.ts:285).

But this validator is wired ONLY into the assessment-write path. The `haiku_human_write` MCP tool — which writes the SAME `rationale` field into `write-audit.jsonl` — performs ZERO size validation:

```bash
$ grep -n 'MAX_RATIONALE\|validateRationaleCaps\|rationale.*length\|rationale.*size' \
    packages/haiku/src/tools/orchestrator/haiku_human_write.ts
# (no matches — only `truncateInstruction` is called, which targets user_instruction_excerpt, not rationale)
```

Confirmed by reading lines 413, 828, 838:
- `:413` extracts `rationale` from args with no validation
- `:828` passes it raw into the `WriteAuditRecord`
- `:838` calls `appendWriteAudit(intentDir, auditRecord)`

## Compounding correctness defect

`appendWriteAudit` documents an atomicity assumption at `packages/haiku/src/orchestrator/workflow/write-audit.ts:165-182`:

> POSIX guarantees that write()s ≤ PIPE_BUF (4 KiB on most platforms) to an O_APPEND file are atomic — no interleaved bytes from concurrent writers. **v1 audit records comfortably fit within that bound.**

That bound is FALSE the moment an unbounded `rationale` lands in the record. A 5 KiB rationale → record JSON > 4 KiB → POSIX no longer guarantees atomic append → concurrent writers (the SPA upload route + `haiku_human_write` calls + future audit writers) can interleave bytes mid-line, producing corrupt JSONL that crashes any downstream parser (drift-gate, assessments-list endpoint, BLUE-TEAM-VERIFICATION's `git show <sha>:write-audit.jsonl` reads).

This compounds the V-09 threat class: a single write with a 5 MB rationale is a (a) DoS on disk + (b) atomicity-break that corrupts the audit log itself for OTHER concurrent writes that were about to be perfectly fine. The audit-log integrity story (already partially deferred via R-2 hash-chain) gets a second integrity hole that doesn't even need attacker action — a single benign large write breaks it.

## Root cause

The cap belongs at the chokepoint (`appendWriteAudit`), not at the route boundary. The unit-01 fix put it at `haiku_classify_drift`'s schema validation; the unit-02/03 fixes never ported the same chokepoint discipline to `haiku_human_write` for the rationale field. Same root-cause-vs-symptom shape as FB-17 (attribute_to_user not validated on MCP path): one writer was hardened, the other was missed, the integrity-relevant struct travels through both.

## Defense-in-depth check

The mandate requires "rate limiting and abuse prevention cover automated attack scenarios, not just manual misuse." A misbehaving agent (or a hostile LLM-generated rationale) writing a 100 MB rationale per call is the abuse-prevention case the cap exists to protect against. The cap that protects this case is at the wrong layer.

## Concrete fix

Add `validateRationaleCaps({ agent_rationale: rationale })` (or equivalent) call inside `haiku_human_write.ts:413-415` after extraction, returning a structured `rationale_too_long` error before `appendWriteAudit` runs. Or, cleaner: move the cap into `appendWriteAudit` itself so it's enforced on every writer.

Add a regression test that calls `haiku_human_write` with a 50 KB rationale and asserts the call rejects with `rationale_too_long`.

## Mitigation does not introduce new attack surface check

The current behavior introduces new attack surface (atomicity break on the audit log) that the threat-model does not account for. The R-2 deferred residual (audit-log hash chain) assumed at-rest tampering is the threat; this finding shows that AT WRITE TIME the audit log is already corruptible by a single oversized append, with no attacker required. The mitigation R-2 is supposed to defend (audit-log integrity) is structurally undermined by the missing cap on the producer side.

## Files / lines

- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:413` — `rationale` extracted with no validation
- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:828` — passed raw into `WriteAuditRecord`
- `packages/haiku/src/orchestrator/workflow/write-audit.ts:117-120` — only `truncateInstruction` exists; no `truncateRationale`
- `packages/haiku/src/orchestrator/workflow/write-audit.ts:165-182` — atomicity comment that becomes false above 4 KiB record size
- `packages/haiku/src/state-tools.ts:105-167` — `MAX_RATIONALE_BYTES` + `validateRationaleCaps` exist, just not called from this path
- ASSESSMENTS.md V-09 row — needs an addendum noting the MCP-write path is uncovered

This is in-spirit V-09 + in-spirit V-03/R-2 simultaneously — the mitigation for one ("unbounded rationale") is bypassed via a sibling writer, AND the bypass introduces a new integrity attack surface on a different control (audit-log atomicity).
