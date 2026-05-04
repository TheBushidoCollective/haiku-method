---
title: Human-attributed write MCP tool contract
model: sonnet
depends_on:
  - unit-01-architecture-spec
inputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/ARCHITECTURE.md
  - knowledge/DESIGN-DECISIONS.md
  - knowledge/DISCOVERY.md
outputs:
  - stages/design/artifacts/MCP-TOOL-CONTRACT.md
status: completed
bolt: 1
hat: design-reviewer
started_at: '2026-04-28T19:59:29Z'
hat_started_at: '2026-04-28T20:04:17Z'
iterations:
  - hat: designer
    started_at: '2026-04-28T19:59:29Z'
    completed_at: '2026-04-28T20:04:17Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-28T20:04:17Z'
    completed_at: '2026-04-28T20:04:55Z'
    result: advance
completed_at: '2026-04-28T20:04:55Z'
---
# Human-attributed write MCP tool contract

Specify the new MCP tool that lets the agent write a file as a human-attributed write — the path used when a user says "hey claude, write this file for me." This is distinct from a normal agent write because it stamps the baseline with `author-class: human-via-mcp`, which makes the next tick's drift gate skip the file (no drift to detect; the human authored this through the agent's hand). The output is a contract document the development stage will implement against.

## Scope

The MCP-TOOL-CONTRACT.md must specify:

- **Tool name** — propose a working name (e.g. `haiku_write_human_file` or `haiku_human_write`); design will refine if naming conflicts with existing tools.
- **Input shape** — file path (must be inside the intent's tracked surface), file content (string or base64 binary), optional human-author-id (the user identifier from the conversation context), optional rationale (free-text reason captured for audit).
- **Output shape** — confirmation of write, the resulting baseline-stamp record (path, SHA, author-class, timestamp, human-author-id), and any boundary checks (did the path require creation of intermediate dirs).
- **Write semantics** — the file is written to disk like any other write, but the baseline-update step uses `author-class: human-via-mcp` instead of `agent`. Result: the next pre-tick gate sees a stamped baseline, not a drift event.
- **Path constraints** — what's allowed (knowledge files, stage outputs, replaceable artifact files), what's denied (workflow-managed files: `units/*.md`, `feedback/*.md`, `intent.md`, `state.json` — those remain MCP-tool-only at the agent level via the existing PreToolUse hook). The new tool MUST refuse to write into the workflow-managed-file zones.
- **Integrity stance for the open question** (`Decision 9 — Human-write path integrity`) — surface the trade-off but recommend a stance: tool can be invoked by the agent only after a human turn in the conversation has explicitly requested the write (the agent SHOULD echo the request and the rationale in its tool call). Enforcement at the harness level is out of scope for v1; the boundary is conversational discipline + audit trail.
- **Audit trail** — every invocation appends to a per-intent audit log (path: stage's existing audit area). The log records who, what, when, why. The audit log is human-readable and append-only.
- **Error contracts** — denied path (returns `path_outside_tracked_surface` with the rejection reason), missing rationale (returns `rationale_required` if config demands it), conflicting baseline (returns `baseline_conflict` if a concurrent agent write happened — caller retries).
- **Integration with the SPA upload pathway** — note that SPA uploads also stamp `human-via-mcp`-class baselines but go through a separate API endpoint (covered by the SPA UI unit); this MCP tool covers only the agent-conversation pathway.

## Completion Criteria

- MCP-TOOL-CONTRACT.md exists at `stages/design/artifacts/MCP-TOOL-CONTRACT.md` and is at least 3KB of substantive prose
- Document names the tool with a working name and explicitly flags the name as design-stage-final, development-stage-implementable
- Document specifies input shape (file path, content, optional human-author-id, optional rationale) and output shape (write confirmation + baseline-stamp record)
- Document specifies the path-allow-list (knowledge, stage outputs, replaceable artifacts) and the path-deny-list (workflow-managed files: units, feedback, intent.md, state.json) — the deny-list is explicit and verifiable by reading the spec
- Document specifies the integrity stance for Decision 9 (conversational discipline + audit trail; harness-level enforcement deferred) with a one-paragraph rationale citing DISCOVERY.md's "hook bypass becomes a liability" risk
- Document specifies the audit-log shape (who, what, when, why) and confirms the log is human-readable + append-only
- Document specifies ≥3 error contracts with named error codes (`path_outside_tracked_surface`, `rationale_required`, `baseline_conflict`)
- Document distinguishes the agent-conversation pathway (this MCP tool) from the SPA upload pathway (separate API surface, covered by the SPA UI unit) — both stamp `human-via-mcp` baselines but go through different entry points
- Document does NOT contain TypeScript file paths, function signatures, or shell commands — working labels and contract shapes only
- Document references ARCHITECTURE.md's baseline-update contract and is consistent with the `human-via-mcp` author-class defined there
