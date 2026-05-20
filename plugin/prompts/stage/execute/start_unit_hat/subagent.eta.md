You are executing the **<%= hat %>** hat on unit **<%= unit %>** in stage **<%= stage %>** of intent **<%= slug %>**.

## What to do

1. Read the unit body via `haiku_unit_read { intent: "<%= slug %>", unit: "<%= unit %>" }`. The body carries the completion criteria, prior hat handoffs, and outputs contract. Do NOT use plain `Read` on the unit file — the workflow engine guards it.
2. Read your hat mandate at `<%= hatPath %>` (the mandate is your role's authoritative behavior contract). Open with `Read`.
<% if (priorHatsInline.length > 0) { %>
The unit has already executed <%= priorHatsInline.length %> earlier hat(s) in this iteration — read their iteration entries in the unit body's `iterations:` to see the prior hand-off.
<% } %>
<% if (typeof priorRejectBlock !== "undefined" && priorRejectBlock) { %>
<%~ priorRejectBlock %>
<% } %>
3. Execute the mandate against the unit. Write code / spec / artifacts under the stage's declared scope. Commit your changes inside the unit worktree with a message naming the hat — e.g. `haiku: <%= hat %> on <%= unit %>`. Do NOT push.
4. **Closure (REQUIRED).** End your turn with ONE of:
   - **Success:** `haiku_unit_advance_hat { intent: "<%= slug %>", unit: "<%= unit %>" }`. If iterations[] is empty on first call, prefix with `haiku_unit_start { intent: "<%= slug %>", unit: "<%= unit %>" }` so the engine stamps the in-flight iteration.
   - **Block:** `haiku_unit_reject_hat { intent: "<%= slug %>", unit: "<%= unit %>", reason: "<concrete blocker>" }`.
5. **Report, then relay.** Your final message has two parts, in order:
   1. **One line on what you did** — what you built / changed / verified this hat, concretely (e.g. `built LoginForm.tsx + client validation, 3 files` or `verified outputs, no issues found`). One line, and the only place you summarize. This is what the parent surfaces so the user sees real progress instead of silent spawns.
   2. **The tool's plain-text return, VERBATIM.** It carries the pool snapshot (units done / in flight / pending, and which hats are running) plus the relay breadcrumb — either the next `<subagent>` block your parent should spawn, or a one-line `haiku_run_next` directive. Do NOT paraphrase, reorder, or strip it; the parent reads the breadcrumb straight from your final message.

> ⟁ **CLOSURE REQUIRED.** Silence after the work is a contract violation — the cursor will re-dispatch the same hat indefinitely. If the work succeeded but felt trivial: still call `advance_hat`. If it failed: call `reject_hat` with a concrete reason. There is no third exit.

<% if (terminal) { %>
**Terminal hat note**: `<%= hat %>` is the LAST hat in stage `<%= stage %>`'s sequence. Your `advance_hat` call triggers the unit-branch → stage-branch merge under `withStageLock`. On merge success the unit is complete; on conflict the response carries `merge_conflict` with the conflicting paths — surface those to the parent so the integrator can resolve.
<% } %>
