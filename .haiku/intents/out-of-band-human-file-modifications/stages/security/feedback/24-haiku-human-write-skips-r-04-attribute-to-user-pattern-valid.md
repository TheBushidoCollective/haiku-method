---
title: >-
  haiku_human_write skips R-04 attribute_to_user pattern validation; same XSS
  sink the SPA closed
status: rejected
origin: adversarial-review
author: security (from development)
author_type: agent
created_at: '2026-05-03T11:05:05Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 0
triaged_at: '2026-05-03T11:05:05Z'
resolution: null
replies: []
---

**Severity:** Medium-High

**Summary:** The SPA upload routes apply `ATTRIBUTE_TO_USER_PATTERN = /^[\w][\w\-.@ ]{0,127}$/` to `attribute_to_user` (closes red-team R-04: stored XSS via audit-log poisoning). The MCP tool `haiku_human_write` writes the **same** `claimed_author_id` / `human_author_id` fields to the **same** `write-audit.jsonl` and `action-log.jsonl` consumers — but with **no validation at all**.

**Where:**
- SPA gate (good): `packages/haiku/src/http/upload-routes.ts:192-203, 510-523, 846-857`.
- MCP gate (missing): `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:365-374, 401-412, 795-806, 820-836`. Both `claimed_author_id` and `human_author_id` are accepted as arbitrary strings; no length cap, no pattern, no sanitization. They are written verbatim into both audit logs.

**Attack:**
1. A user-chat instruction (or a prompt-injected document the agent processes) directs the agent to call `haiku_human_write` with `claimed_author_id: "<img src=x>"`.
2. The string lands verbatim in `write-audit.jsonl` and `action-log.jsonl`.
3. Any future SPA renderer that displays the audit log (the natural next surface; the V-09 truncation work in `assessments-routes.ts:43-75` shows the team is actively building this) re-emits the payload into the reviewer's privileged tunnel origin.
4. Same XSS sink R-04 closed for SPA uploads is still wide open for the MCP path.

**Spirit-of-mandate violation:** The mandate requires "input validation occurs at system boundaries." The MCP tool is a system boundary — every call originates from an LLM that processes attacker-controllable input (chat, files, web search results). The SPA path's `isValidAttributeToUser` enforces the boundary; the MCP path treats agent-supplied claims as already-trusted. The comment at `haiku_human_write.ts:368` explicitly defers responsibility to "reviewers reading audit logs" — that is **NOT input validation**, it is "hope no one renders this." The mitigation is also strictly weaker than the SPA path because the on-disk artefact is what gets shared with downstream tooling, not the runtime "treat as claim" warning.

**Suggested fix:**
- Import `ATTRIBUTE_TO_USER_PATTERN` / `isValidAttributeToUser` from `upload-routes.ts` (or move to a shared module like `feedback-sanitize.ts`).
- Apply it to both `claimed_author_id` and `human_author_id` in `haiku_human_write.handle` after extraction (around line 412), returning a structured `bad_attribute_to_user` error consistent with the SPA's 400 envelope.
- Add a length cap on `rationale` and `user_instruction_excerpt` while you're there — currently both are unbounded which feeds the audit-log atomicity finding (separate FB).

---

**Rejection reason:** Duplicate of FB-17 (mitigation-effectiveness lens). Both findings flag the same gap: haiku_human_write MCP tool skips the attribute_to_user / R-04 validation pattern that the SPA upload route enforces. Same code change closes both — bind validation in the tool's handler. FB-17 will drive the fix; rejecting this duplicate to avoid redundant fix-loop dispatch.</reason>
</invoke>
