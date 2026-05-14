# Dispatch review-agent `<%= role %>` on stage `<%= stage %>`

The cursor's spec-review track requires `reviews.<%= role %>` on <%= unitCount %> unit(s):

<% for (const u of units) { %>
  - `<%= u %>`
<% } %>

<% if (modelTier) { %>
**Model:** spawn the Task with `model: "<%= modelTier %>"` (resolved via the review-agent mandate cascade).

<% } %>
## What to do

Spawn ONE `<%= role %>` review-agent subagent (single Task call). The subagent's prompt:

```
Read your mandate at plugin/studios/<studio>/stages/<%= stage %>/review-agents/<%= role %>.md. Then read each unit spec via haiku_unit_read for the listed units: <%= unitsList %>. For each unit, evaluate whether the spec aligns with the intent and the upstream stage outputs. If you find a substantive issue, file feedback via haiku_feedback (origin: "adversarial-review", source_ref: "<%= role %>", target_unit: "<unit>", target_invalidates: ["<%= role %>"]). After reviewing all listed units, stamp reviews.<%= role %> on each by calling haiku_run_next — the engine sees you've finished and stamps the sigs. Terminate with a one-line summary of findings.
```

When the review-agent terminates, call `haiku_run_next { intent: "<%= slug %>" }`. The cursor will route to the next missing review role, or to the user gate if all configured agents have signed.
