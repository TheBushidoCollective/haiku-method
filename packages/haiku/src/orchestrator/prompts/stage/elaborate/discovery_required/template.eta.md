<% if (!composedMode) { %>
# Discovery required: `<%= agent %>`<%= unitLabel %>

<% } %>
Stage `<%= stage %>` declares discovery agent `<%= agent %>`. The artifact at `<%= resolvedLocation || "(template missing)" %>` is not on disk yet — run the agent before decompose proceeds. (File existence IS the signal that discovery ran; there is no FM stamp.)

<% if (!def) { %>
The studio configuration is missing the template file for discovery agent `<%= agent %>`. Fix the studio configuration; this should never reach the agent in a healthy intent.
<% } else if (def.tool) { %>
## What to do

This discovery template is **tool-driven**: call the `<%= def.tool %>` MCP tool. The tool produces the artifact at `<%= resolvedLocation %>` as a side effect. The cursor reads that path on the next tick — file existence IS the signal that discovery ran.

### Template body (for context)

```markdown
<%= def.body.trim() %>
```

Call `<%= def.tool %> { intent: "<%= slug %>" }` (plus any tool-specific arguments documented in the template body above). When the tool returns, call `haiku_run_next { intent: "<%= slug %>" }` to re-tick.

<% if (!composedMode) { %><%~ concurrentLoopBlock %><% } %>
<% } else { %>
## What to do

Spawn one subagent for the `<%= agent %>` discovery template against unit `<%= unit %>`.

<%~ dispatchBlock %>

When the subagent returns, call `haiku_run_next { intent: "<%= slug %>" }`. The cursor will dispatch the next missing discovery artifact, or — once every required output is on disk — move on to the execute wave.

<% if (!composedMode) { %><%~ concurrentLoopBlock %><% } %>
<% } %>
