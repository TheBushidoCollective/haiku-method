# Dispatch <% if (isEngineRole) { %>engine approval `<%= role %>`<% } else { %>approval-agent `<%= role %>`<% } %> on stage `<%= stage %>` (post-execute)

The cursor's output-approval track requires `approvals.<%= role %>` on <%= unitCount %> unit(s) — the work has landed and needs a sign-off on the WORK (not the spec; the pre-execute `dispatch_review` already signed the spec):

<% for (const u of units) { %>
  - `<%= u %>`
<% } %>

## What to do

Spawn ONE `<%= role %>` approval-agent subagent (single Task call). The full subagent prompt — mandate, unit specs to approve, output paths to read, procedure — is in the file referenced by the `<subagent>` block below; pass that block verbatim to the Task tool.

<%~ dispatchBlock %>

When the approval-agent terminates, call `haiku_run_next { intent: "<%= slug %>" }`. If FBs were filed, the cursor routes to Track B (fix loop). If clean, it routes to the next missing approval role or to the user gate.
