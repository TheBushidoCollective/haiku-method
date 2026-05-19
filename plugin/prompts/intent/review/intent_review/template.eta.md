<% if (role === "user") { %>
# Intent-completion gate: user approval

Every stage of intent **<%= slug %>** is merged into intent main and every required agent reviewer has signed. The user is the last signature before the engine seals the intent.

## What to do

1. Call `haiku_review_open { intent: "<%= slug %>", scope: "intent" }` to open the intent-completion review session.
2. Post the returned URL to the user — one or two sentences, no walls of text.
3. Call `haiku_await_gate { intent: "<%= slug %>" }` and block on the decision.
4. On approve, the engine stamps `approvals.user` on intent.md and the next tick emits `seal_intent` → `sealed`. On request_changes, the engine writes the annotations as intent-scope feedback and the cursor walks Track B on the next tick.
<% } else if (mandatePath) { %>
# Intent-completion review: `<%= role %>`

Every stage of intent **<%= slug %>** is merged into intent main. Role `<%= role %>` is the next missing signature on `intent.approvals`.

## What to do

Spawn one subagent for the `<%= role %>` review. The mandate is inlined in the dispatch block below.

<%~ dispatchBlock %>

When the subagent returns, call `haiku_run_next { intent: "<%= slug %>" }`. The engine reconciles `approvals.<%= role %>` and either advances to the next role or emits `seal_intent`.
<% } else { %>
# Intent-completion review: `<%= role %>`

Every stage of intent **<%= slug %>** is merged into intent main. Role `<%= role %>` is the next missing signature on `intent.approvals`.

## What to do

Spawn a single `general-purpose` subagent to <%= description %>. Have the subagent log any findings via `haiku_feedback` at intent scope (omit `stage`).

When the subagent returns, call `haiku_run_next { intent: "<%= slug %>" }`. The engine reconciles `approvals.<%= role %>` and either advances to the next role or emits `seal_intent`.
<% } %>
