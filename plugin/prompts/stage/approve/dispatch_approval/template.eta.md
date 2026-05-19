# Dispatch <% if (isEngineRole) { %>engine approval `<%= role %>`<% } else { %>approval-agent `<%= role %>`<% } %> on stage `<%= stage %>` (post-execute)

The cursor's output-approval track requires `approvals.<%= role %>` on <%= unitCount %> unit(s) — the work has landed and needs a sign-off on the WORK (not the spec; the pre-execute `dispatch_review` already signed the spec):

<% for (const u of units) { %>
  - `<%= u %>`
<% } %>

<% if (modelTier) { %>
**Model:** spawn the Task with `model: "<%= modelTier %>"` (resolved via the review-agent mandate cascade).

<% } %>
## What to do

Spawn ONE `<%= role %>` approval-agent subagent (single Task call). The subagent's prompt:

```
<% if (isEngineRole) { %>You are the engine-built-in `<%= role %>` POST-execute approval for stage `<%= stage %>`. The unit specs already passed the pre-execute `<%= role %>` review (see reviews.<%= role %> stamps on the units). Your job is to verify the BUILT work against those specs. Your mandate is inlined below — no file to read.

<%~ engineBody %>

For each listed unit (<%= unitsList %>): read the spec via haiku_unit_read, then read each declared output path on disk, and evaluate the built work against the mandate above. If any output diverges, file feedback (stage: "<%= stage %>", origin: "engine-review", author: "<%= role %>", source_ref: "<%= role %>:approval", target_unit: "<unit>", target_invalidates: ["<%= role %>"]). After reviewing all listed units, stamp approvals.<%= role %> on each — the engine handles this on the next haiku_run_next tick when it sees no unsigned approvals on this role. Terminate with a one-line summary.<% } else if (mandatePath) { %>Read your mandate at <%= mandatePath %>. For each listed unit (<%= unitsList %>): read the spec via haiku_unit_read, then read each declared output path on disk, and evaluate whether the outputs deliver what the spec promised. If any output diverges from the spec, file feedback (stage: "<%= stage %>", origin: "adversarial-review", source_ref: "<%= role %>", target_unit: "<unit>", target_invalidates: ["<%= role %>"]). After reviewing all listed units, stamp approvals.<%= role %> on each. Terminate with a one-line summary.<% } else { %>No mandate file resolved for approval-agent `<%= role %>` in studio/stage (engine bug; the cascade returned no match). Proceed from prior context, file findings via haiku_feedback (stage: "<%= stage %>"), and stamp approvals.<%= role %> via haiku_run_next.<% } %>
```

When the approval-agent terminates, call `haiku_run_next { intent: "<%= slug %>" }`. If FBs were filed, the cursor routes to Track B (fix loop). If clean, it routes to the next missing approval role or to the user gate.
