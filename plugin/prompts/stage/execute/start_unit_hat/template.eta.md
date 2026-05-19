<% if (unitCount === 0) { %>
## start_unit_hat: no units

The cursor returned start_unit_hat with an empty units list. Call `haiku_run_next { intent: "<%= slug %>" }` to retick — likely a transient mid-wave noop misclassified.
<% } else { %>
# Dispatch hat `<%= hat %>` for stage `<%= stage %>`

The cursor identified <%= unitCount %> unit(s) ready for the `<%= hat %>` hat:

<% for (const u of unitLines) { %>
  - <%~ u %>
<% } %>

<% if (someResolved) { %>
**Per-unit model:** spawn each Task with `model: "<tier>"` matching the parenthetical above. Units that escalated after a prior reject (haiku→sonnet→opus) carry their bumped tier in the unit FM, so the wave's slowest member doesn't drag everyone up. Omit the `model` arg only when no tier is shown above.

<% } %>
<% if (showAnnouncement) { %>
<%~ announcementBlock %>

<% } %>
## What to do

<%= batchDirective %>

Each subagent's prompt: "Read .haiku/intents/<%= slug %>/stages/<%= stage %>/units/<unit>.md and execute the `<%= hat %>` hat's mandate. Call `haiku_unit_start` if iterations[] is empty; otherwise the unit is already started. When finished, call `haiku_unit_advance_hat { intent: \"<%= slug %>\", unit: \"<unit>\" }` (on success) or `haiku_unit_reject_hat { intent: \"<%= slug %>\", unit: \"<unit>\", reason: \"<why>\" }` (on block). Terminate with the tool's plain-text return — no summary, no narration.

> ⟁ **CLOSURE REQUIRED.** You MUST end with `haiku_unit_advance_hat` (success) OR `haiku_unit_reject_hat` (block). Terminating without either is a contract violation — the cursor will see your subagent vanish without stamping iteration state and re-dispatch the same hat indefinitely. If your work succeeded but you're tempted to skip the stamp because the hat felt trivial: stamp anyway. If your work failed: `haiku_unit_reject_hat` with the reason. Silence is never the right exit."

Each subagent runs **one hat only**. After it terminates, this dispatch is complete for that unit; the cursor on the next tick will return either the next hat for that unit or a noop while siblings are still in flight.
<% if (terminal) { %>

**Terminal hat note**: `<%= hat %>` is the LAST hat in the stage's sequence. The subagent's `advance_hat` call will trigger the unit-branch → stage-branch merge under `withStageLock`. On merge success, the unit is complete; on conflict, the response carries `merge_conflict` with the conflicting paths for resolution.
<% } %>

After ALL <%= unitCount %> subagent(s) return, call `haiku_run_next { intent: "<%= slug %>" }` exactly once. The cursor will tell you what's next (more wave-ready units, the next wave, or the spec/output review track).

<%~ executeContractsBlock %>

<% if (providerBlock) { %>
<%~ providerBlock %>
<% } %>
<% } %>
