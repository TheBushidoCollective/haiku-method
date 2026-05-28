<% if (isPreIntent) { %>
<% if (!composedMode) { %>
## Pre-Intent Elaborate Review (Substance Verifier)

<% } %>
The conversation that produced `intent.md` for <%= intentSlug %> hasn't been verified. Dispatch a verifier subagent to grade the intent for substance before any stage walk fires.
### Dispatch the verifier

Spawn the `<subagent>` block below with the Task tool. When the verifier returns, do what its final message tells you — its last step is to call `haiku_run_next` itself and relay the cursor's next instruction.

<%~ dispatchBlock %>

### When the verifier returns
- Pass → its final message is already the cursor's next instruction (the verifier called `haiku_run_next` for you). Follow it.
- Fail → take the verifier's gap list back to the user. Update intent.md (re-record via the intent_create flow or via direct body update). Then call `haiku_run_next` for another verification pass.
<% } else { %>
<% if (!composedMode) { %>
## Elaborate Review (Substance Verifier) — <%= stage %>

<% } %>
The conversation artifact at `<%= elabPath %>` exists but is unverified. Dispatch a verifier subagent to grade it for substance before the cursor can advance to `decompose`.
### Dispatch the verifier

Spawn the `<subagent>` block below with the Task tool. When the verifier returns, do what its final message tells you — its last step is to call `haiku_run_next` itself and relay the cursor's next instruction.

<%~ dispatchBlock %>

### When the verifier returns
- Pass → its final message is already the cursor's next instruction (the verifier called `haiku_run_next` for you). Follow it.
- Fail → take the verifier's gap list back to the user. Have the missing conversation. Call `haiku_stage_elaboration_record` again with the updated body — this overwrites the artifact and clears the (still-missing) `verified_at`. Then call `haiku_run_next` for another verification pass.
<% if (!composedMode) { %>

<%~ concurrentLoopBlock %>
<% } %>
<% } %>
