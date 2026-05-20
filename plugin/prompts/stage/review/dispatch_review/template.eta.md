# Dispatch <% if (isEngineRole) { %>engine review `<%= role %>`<% } else { %>review-agent `<%= role %>`<% } %> on stage `<%= stage %>` (pre-execute)

The cursor's pre-execute review track requires `reviews.<%= role %>` on <%= unitCount %> unit(s) — the unit SPECS are ready and need a sign-off BEFORE any code lands (the post-execute work approval is the separate `dispatch_approval` walk):

<% for (const u of units) { %>
  - `<%= u %>`
<% } %>

## What to do

Spawn ONE `<%= role %>` review-agent subagent (single Task call). The full subagent prompt — mandate, unit specs to audit, procedure — is in the file referenced by the `<subagent>` block below; pass that block verbatim to the Task tool.

<%~ dispatchBlock %>

When the review-agent terminates, call `haiku_run_next { intent: "<%= slug %>" }`. The cursor will route to the next missing pre-execute review role, to the user gate if all configured agents have signed, or to the wave-ready hat dispatch if every pre-execute review has signed and no user gate is required.
