<% if (!composedMode) { %>
# Discovery required<% if (dispatchCount > 1) { %> (<%= dispatchCount %> agents)<% } else { %>: `<%= agent %>`<%= unitLabel %><% } %>

<% } %>
<% if (dispatchCount > 1) { %>
Stage `<%= stage %>` declares **<%= dispatchCount %>** discovery agents whose artifacts aren't on disk yet — `<%= dispatches.map(function(d){return d.agent}).join("`, `") %>`. They fan out in parallel; spawn ALL of them in a single response (multiple Task calls in one message for subagent-driven templates, and call any tool-driven templates in the same message). File existence at each `location:` IS the signal that the agent ran — there is no FM stamp.
<% } else { %>
Stage `<%= stage %>` declares discovery agent `<%= agent %>`. The artifact at `<%= resolvedLocation || "(template missing)" %>` is not on disk yet — run the agent before decompose proceeds. (File existence IS the signal that discovery ran; there is no FM stamp.)
<% } %>

<% for (const d of dispatches) { %>
<% if (dispatchCount > 1) { %>
### Discovery agent: `<%= d.agent %>`<%= d.unitLabel %>

Artifact location: `<%= d.resolvedLocation || "(template missing)" %>`.

<% } %>
<% if (!d.def) { %>
The studio configuration is missing the template file for discovery agent `<%= d.agent %>`. Fix the studio configuration; this should never reach the agent in a healthy intent.
<% } else if (d.def.tool) { %>
<% if (dispatchCount === 1) { %>
## What to do

<% } %>
This discovery template is **tool-driven**: call the `<%= d.def.tool %>` MCP tool. The tool produces the artifact at `<%= d.resolvedLocation %>` as a side effect. The cursor reads that path on the next tick — file existence IS the signal that discovery ran.

### Template body (for context)

```markdown
<%= d.def.body.trim() %>
```

Call `<%= d.def.tool %> { intent: "<%= slug %>" }` (plus any tool-specific arguments documented in the template body above).
<% } else { %>
<% if (dispatchCount === 1) { %>
## What to do

Spawn one subagent for the `<%= d.agent %>` discovery template against unit `<%= d.unit %>`.

<% } %>
<%~ d.dispatchBlock %>
<% } %>

<% } %>
<% if (dispatchCount > 1) { %>
When ALL discovery agents terminate (and any tool-driven templates have written their artifacts), call `haiku_run_next { intent: "<%= slug %>" }`. The cursor will route to the next phase once every required output is on disk.
<% } else { %>
When the subagent returns (or the tool call completes), call `haiku_run_next { intent: "<%= slug %>" }`. The cursor will dispatch the next missing discovery artifact, or — once every required output is on disk — move on to the execute wave.
<% } %>

<% if (!composedMode) { %><%~ concurrentLoopBlock %><% } %>
