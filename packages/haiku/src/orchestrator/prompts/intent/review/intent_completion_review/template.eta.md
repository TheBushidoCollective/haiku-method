## Intent-Completion Review: <%= slug %>

All stages for intent **<%= slug %>** have passed their gates. Before opening the final human approval gate, the studio-level review agents audit the whole-intent artifacts against studio-wide standards (cross-stage consistency, brand, tokens, architecture patterns, etc.).

### Review Agent Fan-Out (REQUIRED)

**Spawn exactly one subagent per review agent in parallel — no duplicates.** Findings are logged at **intent scope** (stage omitted) via `haiku_feedback`. After every agent completes, call `haiku_run_next { intent: "<%= slug %>" }` — the workflow will dispatch the studio fix-hat loop against any findings, or open the final gate if the review is clean.<% if (announceBlock) { %>


<%~ announceBlock %>
<% } %>

<%~ dispatchSections %>

### Parent Instructions (do NOT include in subagent prompts)

Spawn review subagents using the `prompt_file` attribute. They persist findings directly via `haiku_feedback` at intent scope.<%= bgLine %>

<%= batchDirective %>

After every agent returns, call `haiku_run_next { intent: "<%= slug %>" }`.
