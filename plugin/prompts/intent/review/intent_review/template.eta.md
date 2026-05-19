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

Every stage of intent **<%= slug %>** is merged into intent main. Role `<%= role %>` is the next missing signature on `intent.approvals`, and the studio shipped no mandate file at the intent tier (`plugin/studios/<studio>/intent-review-agents/<%= role %>.md`). The engine still expects a signature, so spawn a subagent with the fallback mandate below — but file a `haiku_feedback` against the studio (origin `agent`, intent-scope) noting the missing mandate file so the studio author can land one.

## What to do

Spawn one `general-purpose` subagent. Give it the literal block below as its prompt:

```
You are the `<%= role %>` intent-completion reviewer for intent `<%= slug %>`.

Description provided by the engine: <%= description %>

## Mandate (fallback — no studio-configured mandate file was found)

1. Read every stage's `outputs/` and `elaboration.md` under `.haiku/intents/<%= slug %>/stages/`.
2. Read the intent body at `.haiku/intents/<%= slug %>/intent.md`.
3. Judge the intent-as-a-whole against the description above. Look for:
   - work that ships against the intent's stated goals but contradicts another stage's output
   - missing coverage of an intent acceptance criterion across all stages combined
   - any cross-stage inconsistency (terminology, scope, technical choices)
4. For each finding, file `haiku_feedback` with `intent: "<%= slug %>"` (omit `stage`), `origin: "agent"`, `author: "<%= role %>"`, and a body that quotes the artifact you're flagging.
5. When you've finished the read-through, return your verdict as one paragraph: which findings you filed (by FB-NN), or "no findings".

Do NOT modify any artifact files. Reviewer role, not fixer.
```

When the subagent returns, call `haiku_run_next { intent: "<%= slug %>" }`. The engine reconciles `approvals.<%= role %>` and either advances to the next role or emits `seal_intent`.
<% } %>
