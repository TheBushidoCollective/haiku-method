<%~ workflowContractsBlock %>

## Fix Loop: <%= itemCount %> finding(s) in parallel

Dispatching the stage's `fix_hats:` sequence against <%= itemCount %> pending finding(s) in stage **<%= fixStage %>**. Each finding's hat chain runs serially via relay (<%= fixHatsList.join(" → ") %>); chains run in parallel across findings.
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

**Run all <%= itemCount %> in parallel.** When a subagent returns, do what its final message tells you — spawn the relayed `<subagent>` block it carries, call `haiku_run_next`, or just acknowledge. The engine threads the chain via the advance_hat return; you don't decide when to fire the next item.
