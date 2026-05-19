<% if (dispatchCount === 0) { %>
## start_feedback_hat: no FBs

The cursor returned start_feedback_hat with no dispatches. Call `haiku_run_next { intent: "<%= slug %>" }` to retick.
<% } else { %>
# Dispatch <%= dispatchCount %> fix-hat subagent<%= plural %>

Open feedback items ready for their next fix-hat. Each entry is INDEPENDENT — different feedback IDs, potentially different stages, potentially different hats. Spawn ONE subagent per entry, in parallel, in a single message with <%= dispatchCount %> `Task` call<%= plural %>.

<% for (const d of dispatches) { %>
  - `<%= d.feedback_id %>` → stage `<%= d.stage || "(intent)" %>`, hat `<%= d.hat %>`<% if (d.terminal) { %> (terminal)<% } %>
<% } %>

## What to do

<%= batchDirective %>

Each subagent block below carries a `prompt_file` pointing at a complete, self-contained prompt — the hat mandate, the FB-load + execute procedure, and the closure-discipline rules are all inlined into that file so the subagent reads ONE thing. Pass the `<subagent>` block verbatim to the Task tool.

<% dispatches.forEach((d) => { %>
<%~ d.dispatch_block %>
<% if (d.terminal) { %>

**Terminal hat note for `<%= d.feedback_id %>`**: `<%= d.hat %>` is the LAST hat in stage `<%= d.stage %>`'s `fix_hats:` sequence. The subagent's `feedback_advance_hat` call closes the FB (stamps `closed_at`) and applies `targets.invalidates` to the targeted unit's approvals — the cursor on the next tick will route through the invalidated roles to re-run them. The subagent MUST pass a `reply` string to `haiku_feedback_advance_hat` — without it, the tool returns `reply_required` and refuses to close.
<% } %>

<% }) %>
After all <%= dispatchCount %> subagent<%= plural %> return, call `haiku_run_next { intent: "<%= slug %>" }`.

<%~ fixLoopContractsBlock %>
<% } %>
