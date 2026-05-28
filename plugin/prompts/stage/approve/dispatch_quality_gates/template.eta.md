<% if (intentScope) { %>
# Run quality gates at intent scope

Every stage of intent **<%= slug %>** has its post-execute approvals signed. The cursor's intent-completion approval track reached the `quality_gates` role. The intent-scope set is **derived** from the union of every unit's `quality_gates[]` across every stage, deduped by command (per GOALS § "Quality gates are one handler at three scopes"). <%= unitCount %> unit(s) contribute gates:

<% for (const u of units) { %>
  - `<%= u %>`
<% } %>

## What to do

Call `haiku_dispatch_quality_gates { intent: "<%= slug %>", scope: "intent", units: <%~ unitsJson %> }`. The tool walks every contributing unit, dedupes commands, runs each distinct command once against the integrated intent state, and stamps `approvals.intent_quality_gates` at intent scope on success. Failures file FBs at intent scope with `targets.invalidates: ["intent_quality_gates"]`; the next tick routes through Track B and the studio fix-hat loop.

After it returns, call `haiku_run_next { intent: "<%= slug %>" }`. If all gates passed, the cursor advances toward `seal_intent`. If any FBs were filed, the cursor routes to Track B (intent-scope fix loop) to address them.
<% } else { %>
# Run quality gates on stage `<%= stage %>`

The cursor's post-execute approval track reached the `quality_gates` role. <%= unitCount %> unit(s) need their declared gates run:

<% for (const u of units) { %>
  - `<%= u %>`
<% } %>

## What to do

Call `haiku_dispatch_quality_gates { intent: "<%= slug %>", stage: "<%= stage %>", units: <%~ unitsJson %> }`. The tool runs each unit's `quality_gates` commands synchronously, stamps `approvals.quality_gates` on units that pass, and files an FB on each unit that fails.

After it returns, call `haiku_run_next { intent: "<%= slug %>" }`. If all gates passed, the cursor routes to the next role; if any FBs were filed, the cursor routes to Track B (fix loop) to address them.
<% } %>
