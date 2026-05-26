<% if (role === "user") { %>
# Intent-completion gate: user approval

Every stage of intent **<%= slug %>** is merged into intent main and every required agent reviewer has signed. The user is the last signature before the engine seals the intent.

## What to do

1. Call `haiku_review_open { intent: "<%= slug %>", scope: "intent" }` to open the intent-completion review session.
2. Post the returned URL to the user — one or two sentences, no walls of text.
3. Call `haiku_await_gate { intent: "<%= slug %>" }` and block on the decision.
4. On approve, the engine stamps `approvals.user` on intent.md and the next tick emits `seal_intent` → `sealed`. On request_changes, the engine writes the annotations as intent-scope feedback and the cursor walks Track B on the next tick.
<% } else if (dispatchCount > 1) { %>
# Intent-completion review — adversarial fan-out (<%= dispatchCount %> agents)

Every stage of intent **<%= slug %>** is merged into intent main. <%= dispatchCount %> intent-completion review agents still need to sign `intent.approvals`: <%= roles.join(", ") %>.

## What to do

Spawn ALL <%= dispatchCount %> subagents **in parallel** (multiple Task calls in a single message). Each subagent's full prompt — mandate, what to audit, procedure — is in the file referenced by its `<subagent>` block below; pass each block verbatim to the Task tool.

<%~ dispatchBlock %>

When ALL subagents terminate, call `haiku_run_next { intent: "<%= slug %>" }`. The engine signs every role that filed no findings and re-dispatches any that did; once every intent-review role is signed the cursor advances to the user gate (if any) or `seal_intent`. Intent-review subagents do NOT call `haiku_review_stamp` — they terminate with their verdict and the engine stamps them.
<% } else { %>
# Intent-completion review: `<%= role %>`

Every stage of intent **<%= slug %>** is merged into intent main. Role `<%= role %>` is the next missing signature on `intent.approvals`.

## What to do

Spawn ONE subagent for the `<%= role %>` review (single Task call). The mandate is inlined in the dispatch block below — pass it verbatim to the Task tool.

<%~ dispatchBlock %>

When the subagent returns, call `haiku_run_next { intent: "<%= slug %>" }`. The engine reconciles `approvals.<%= role %>` and either advances to the next role / the user gate or emits `seal_intent`. The subagent does NOT call `haiku_review_stamp` — it terminates with its verdict and the engine stamps it.
<% } %>
