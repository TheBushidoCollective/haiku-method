# Dispatch approval-agent `<%= role %>` on stage `<%= stage %>`

The cursor's output-approval track requires `approvals.<%= role %>` on <%= unitCount %> unit(s):

<% for (const u of units) { %>
  - `<%= u %>`
<% } %>

<% if (modelTier) { %>
**Model:** spawn the Task with `model: "<%= modelTier %>"` (resolved via the review-agent mandate cascade).

<% } %>
## What to do

Spawn ONE `<%= role %>` review-agent subagent (single Task call). The subagent's prompt:

```
Read your mandate at plugin/studios/<studio>/stages/<%= stage %>/review-agents/<%= role %>.md. For each listed unit (<%= unitsList %>): read the spec via haiku_unit_read, then read each declared output path on disk, and evaluate whether the outputs deliver what the spec promised. If any output diverges from the spec, file feedback (origin: "adversarial-review", source_ref: "<%= role %>", target_unit: "<unit>", target_invalidates: ["<%= role %>"]). After reviewing all listed units, stamp approvals.<%= role %> on each — the engine handles this on the next haiku_run_next tick when it sees no unsigned approvals on this role. Terminate with a one-line summary.
```

When the review-agent terminates, call `haiku_run_next { intent: "<%= slug %>" }`. If FBs were filed, the cursor routes to Track B (fix loop). If clean, it routes to the next missing approval role or to the user gate.
