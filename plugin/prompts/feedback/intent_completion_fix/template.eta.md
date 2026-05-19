<%~ workflowContractsBlock %>

## Intent-Completion Fix Loop: <%= itemCount %> finding(s) in parallel

Studio-level findings will be addressed by dispatching the studio's `fix-hats/` sequence against each finding. Per-finding sequence: <%= fixHatsList.join(" → ") %> (serial within chain via relay). Chains run in parallel across findings.
<% if (escalatedCount > 0) { %>

> ⚠ <%= escalatedCount %> additional finding(s) are at the bolt cap and will escalate after this batch completes.
<% } %>
<% if (showTotalsLine) { %>

> Total pending: <%= totalPending %>. Dispatching: <%= itemCount %>. At cap: <%= escalatedCount %>.
<% } %>

### Self-Extending Chain Dispatch

Each finding below launches ONE subagent (the first hat). That subagent calls `haiku_feedback_advance_hat` when done and relays the next hat's `<subagent>` block back to the parent for spawning. **The parent spawns the relayed block — the subagent does NOT.** The chain ends when the final hat (assessor) returns without a relay block. Chains run in parallel across findings.

<% if (showAnnouncement) { %>
<%~ announcementBlock %>
<% } %>

<% for (const f of findings) { %>

### Finding `<%= f.fbId %>` — _<%= f.fbTitle %>_ (bolt <%= f.fixBolt %>/<%= fixMaxBolts %>)
<% if (f.warnings) { %>

<%~ f.warnings %>
<% } %>

<%~ f.firstHatBlock %>
<% } %>

### Parent Instructions

Spawn each `<subagent>` block above using the Task tool: `type` → `subagent_type`; `model` → `model` (omit when absent); <%~ bgClause %>`prompt_file` → prompt body is literally `"Read <path> and execute its instructions exactly."`. Do not add anything beyond that one-line prompt body — the workflow engine owns the authoritative prompt at the file path.

**Run all <%= itemCount %> in parallel.** When each subagent returns, follow its return instruction. A returned subagent's final message will either include a literal `<subagent>` relay block (sourced from the `next_subagent_dispatch_block` field of its `haiku_feedback_advance_hat` tool response) — spawn that immediately as the next hop in the same chain — or a one-line summary ending with `call haiku_run_next`. Spawn relayed blocks before pulling more work; chain completion (no more relay blocks) is what frees a slot for the next pending finding.

When ALL chains complete, call `haiku_run_next { intent: "<%= slug %>" }` — the workflow engine decides what happens next.
