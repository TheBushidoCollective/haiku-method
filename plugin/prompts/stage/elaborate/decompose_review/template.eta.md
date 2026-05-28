<% if (!composedMode) { %>
## Decompose Review (Coverage + Spec-vs-Intent Verifier) — <%= stage %>

<% } %>
Units exist for stage `<%= stage %>` but the decompose-verifier has not stamped `decompose_verified_at` on `<%= elabPath %>`. Dispatch a verifier subagent to audit that the drafted units (a) cover what the captured conversation agreed on AND (b) align with what the intent itself scoped for this stage.
### Dispatch the verifier

Spawn the `<subagent>` block below with the Task tool. When the verifier returns, do what its final message tells you — its last step is to call `haiku_run_next` itself and relay the cursor's next instruction.

<%~ dispatchBlock %>

### When the verifier returns
Its final message is the cursor's next instruction (it called `haiku_run_next` for you). Follow it.
<% if (!composedMode) { %>

<%~ concurrentLoopBlock %>
<% } %>
