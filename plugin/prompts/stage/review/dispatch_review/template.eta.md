# Dispatch <% if (isEngineRole) { %>engine review `<%= role %>`<% } else { %>review-agent `<%= role %>`<% } %> on stage `<%= stage %>` (pre-execute)

The cursor's pre-execute review track requires `reviews.<%= role %>` on <%= unitCount %> unit(s) — the unit SPECS are ready and need a sign-off BEFORE any code lands (the post-execute work approval is the separate `dispatch_approval` walk):

<% for (const u of units) { %>
  - `<%= u %>`
<% } %>

<% if (modelTier) { %>
**Model:** spawn the Task with `model: "<%= modelTier %>"` (resolved via the review-agent mandate cascade).

<% } %>
## What to do

Spawn ONE `<%= role %>` review-agent subagent (single Task call). The subagent's prompt:

```
<% if (isEngineRole) { %>You are the engine-built-in `<%= role %>` PRE-execute review for stage `<%= stage %>`. No code has landed yet — you are auditing the unit specs and planned graph BEFORE execute fires. Your mandate is inlined below — no file to read.

<%~ engineBody %>

Then read each unit spec via haiku_unit_read for the listed units: <%= unitsList %>. For each unit, evaluate the SPEC against the mandate above (the work hasn't landed yet, so there's nothing to read on disk). If you find a substantive issue with the planned spec, file feedback via haiku_feedback (stage: "<%= stage %>", origin: "engine-review", author: "<%= role %>", source_ref: "<%= role %>:review", target_unit: "<unit>", target_invalidates: ["<%= role %>"]). After reviewing all listed units, stamp reviews.<%= role %> on each by calling haiku_run_next — the engine sees you've finished and stamps the sigs. Terminate with a one-line summary of findings.<% } else if (mandatePath) { %>Read your mandate at <%= mandatePath %>. Then read each unit spec via haiku_unit_read for the listed units: <%= unitsList %>. For each unit, evaluate whether the SPEC aligns with the intent and the upstream stage outputs — this is a pre-execute review, so no built work exists yet. If you find a substantive issue with the spec, file feedback via haiku_feedback (stage: "<%= stage %>", origin: "adversarial-review", source_ref: "<%= role %>", target_unit: "<unit>", target_invalidates: ["<%= role %>"]). After reviewing all listed units, stamp reviews.<%= role %> on each by calling haiku_run_next. Terminate with a one-line summary of findings.<% } else { %>No mandate file resolved for review-agent `<%= role %>` in studio/stage (engine bug; the cascade returned no match). Proceed from prior context, file findings via haiku_feedback (stage: "<%= stage %>"), and stamp reviews.<%= role %> via haiku_run_next.<% } %>
```

When the review-agent terminates, call `haiku_run_next { intent: "<%= slug %>" }`. The cursor will route to the next missing pre-execute review role, to the user gate if all configured agents have signed, or to the wave-ready hat dispatch if every pre-execute review has signed and no user gate is required.
