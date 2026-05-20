<% if (unitCount === 0) { %>
## start_unit_hat: no units

The cursor returned start_unit_hat with an empty units list. Call `haiku_run_next { intent: "<%= slug %>" }` to retick — likely a transient mid-wave noop misclassified.
<% } else { %>
# Dispatch hat `<%= hat %>` for stage `<%= stage %>`

The cursor identified <%= unitCount %> unit(s) ready for the `<%= hat %>` hat. Each `<subagent>` block below carries a `prompt_file` pointing at a complete, self-contained prompt — the per-unit context, hat mandate path, prior-hat hand-offs, and closure contract are all inlined into that file so the subagent reads ONE thing. Each block's `model="..."` attribute carries the resolved per-unit tier (escalated units that bumped haiku→sonnet→opus after a reject keep their bumped tier) — pass it through exactly.
<% if (showAnnouncement) { %>

<%~ announcementBlock %>
<% } %>

## What to do

<%= batchDirective %>

Pass each `<subagent>` block verbatim to the Task tool. Map block attributes to the tool params: `type="..."` → `subagent_type`, `model="..."` → `model` (omit when absent), `prompt_file="..."` → the prompt body is literally `"Read <path> and execute its instructions exactly."`. Do not paraphrase, do not add anything beyond the one-line prompt body — the workflow engine owns the authoritative prompt at the file path.

<% for (const block of dispatchBlocks) { %>
<%~ block %>

<% } %>
Each subagent runs **one hat only**. When a subagent returns, do what its final message tells you — spawn the relayed `<subagent>` block if the body carries one, call `haiku_run_next` if the body says so, or just acknowledge. The engine threads the chain through advance_hat's return; you don't decide when to fire the next item.
<% if (terminal) { %>

**Terminal hat note**: `<%= hat %>` is the LAST hat in the stage's sequence. Each subagent's `advance_hat` call triggers the unit-branch → stage-branch merge under `withStageLock`. On merge success the unit is complete; on conflict the response carries `merge_conflict` with the conflicting paths for resolution.
<% } %>

<%~ executeContractsBlock %>
<% } %>
