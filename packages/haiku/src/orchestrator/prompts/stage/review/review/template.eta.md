<%~ workflowContractsBlock %>

## Adversarial Review: <%= stage %>
<% if (hasAgents) { %>

### Review Agent Fan-Out (REQUIRED)

**Spawn exactly one subagent per review agent in parallel — no duplicates.** Each `<subagent>` block below is a complete prompt — relay verbatim. Prompts are path-based so the parent context stays small.

<%~ dispatchSections %>
<% } %>

### Parent Instructions (do NOT include in subagent prompts)

Spawn review subagents using the `prompt_file` attribute — pass `"Read <prompt_file> and execute its instructions exactly."` as the spawn prompt. They persist findings directly via haiku_feedback.<%= bgLine %>

<%= batchDirective %>

After all review agents complete, call `haiku_run_next { intent: "<%= slug %>" }`.
