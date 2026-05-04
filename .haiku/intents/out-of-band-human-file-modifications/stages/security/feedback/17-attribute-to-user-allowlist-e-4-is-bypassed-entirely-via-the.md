---
title: >-
  attribute_to_user allowlist (E-4) is bypassed entirely via the
  haiku_human_write MCP path
status: addressed
origin: adversarial-review
author: mitigation-effectiveness
author_type: agent
created_at: '2026-05-03T11:04:10Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 3
triaged_at: '2026-05-03T11:04:10Z'
resolution: inline_fix
replies: []
hat: security-engineer
iterations:
  - bolt: 3
    hat: security-engineer
    completed_at: '2026-05-03T14:13:53Z'
    result: advanced
---
## Mandate violation

THREAT-MODEL.md §3.6 row E-4 claims:

> `ATTRIBUTE_TO_USER_PATTERN = /^[\w][\w\-.@ ]{0,127}$/` (commit `bfa4b7c91`). Wide enough for real human IDs, narrow enough to reject every HTML/JS sigil.

ASSESSMENTS.md V-03 row likewise says R-04 closed audit-log XSS-sink poisoning via this allowlist. The mitigation does not actually address the threat at the root cause — only at one of two callsites.

## Root cause vs symptom (mandate check #1)

The threat (E-4) is: arbitrary string → `claimed_author_id` / `human_author_id` → `action-log.jsonl` + `write-audit.jsonl` → future SPA audit-log viewer renders → stored XSS.

The fix (`isValidAttributeToUser` + `ATTRIBUTE_TO_USER_PATTERN`) is wired ONLY into the SPA upload routes:
- `packages/haiku/src/http/upload-routes.ts:514` (stage-output)
- `packages/haiku/src/http/upload-routes.ts:848` (knowledge)

The `haiku_human_write` MCP tool — the OTHER chokepoint that writes `claimed_author_id` to the same `action-log.jsonl` and `write-audit.jsonl` — performs ZERO validation:

```bash
$ grep -n 'isValidAttributeToUser\|ATTRIBUTE_TO_USER\|claimedAuthorId.*test\|claimedAuthorId.*regex' \
    packages/haiku/src/tools/orchestrator/haiku_human_write.ts
# (no matches)
```

The agent — or anything calling the MCP tool — can pass `claimed_author_id: "<img src=x>"` and the value flows verbatim through `appendActionLogEntry` (`packages/haiku/src/tools/orchestrator/haiku_human_write.ts:795-806`) and `appendWriteAudit` (`:820-838`) into both audit logs. The exact stored-XSS sink R-04 was filed to close.

This is the textbook "fix the symptom on one path, leave the root cause on another" pattern the mandate warns against. The root cause is "audit-log writers accept unvalidated attribution strings"; the fix only touched one of those writers.

## Defense-in-depth check (mandate check #2)

Critical threat (audit-log XSS sink) has only one layer:
- Layer 1: input validation at SPA upload route (present, partial coverage)
- Layer 2: input validation at MCP tool (MISSING — this is the gap)
- Layer 3: output-side encoding when SPA renders audit logs (NOT IN SCOPE here; would close the symptom but not the integrity issue)

Defense-in-depth would put the validator inside `appendActionLogEntry` / `appendWriteAudit` themselves (or in the WriteAuditRecord constructor) so EVERY writer goes through the same gate. The current placement at the route boundary is brittle — every new writer must remember to call `isValidAttributeToUser` independently.

## Concrete fix

Move the validator to the chokepoint:
- Add `isValidAttributeToUser` (or equivalent) call inside `appendWriteAudit` at `packages/haiku/src/orchestrator/workflow/write-audit.ts:175` and inside `appendActionLogEntry` at the equivalent point — reject the write with a structured error if `claimed_author_id` / `human_author_id` violate the pattern.
- Then remove the duplicate route-level checks in `upload-routes.ts:514` and `:848` (or keep them as early-exit guards but rely on the chokepoint as the load-bearing one).
- Add a regression test that calls `haiku_human_write` with an HTML payload in `claimed_author_id` and asserts the call rejects (or, if the policy is "log-but-strip", asserts the on-disk record contains the sanitized value).

## Files / lines

- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:409-412` — `claimedAuthorId` extraction with no validation
- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:795-806` — `appendActionLogEntry` call passes raw value
- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:820-838` — `appendWriteAudit` call passes raw value
- `packages/haiku/src/http/upload-routes.ts:192` — `ATTRIBUTE_TO_USER_PATTERN` defined but only referenced by the route handlers, not by audit-log helpers
- THREAT-MODEL.md §3.6 row E-4 — claim that the allowlist closes the threat is OVERSTATED at minimum, FALSE for the MCP path
- ASSESSMENTS.md V-03 row "R-04 attribute_to_user allowlist closed in `bfa4b7c91`" — needs an addendum noting MCP-path coverage gap

This is a spirit-violation of V-03's R-04 closure: the letter is satisfied (an allowlist exists somewhere) but the threat (audit-log poisoning) remains exploitable via the MCP path with no additional attacker effort.
