# User gate: `<%= gateKind %>` review on stage `<%= stage %>`

<% if (gateKind === "spec") { %>
The cursor reached the user's spec review. <%= unitCount %> unit spec(s) need approval before execution begins:
<% } else { %>
The cursor reached the user's output approval. <%= unitCount %> unit output(s) need approval before the stage merges:
<% } %>

<% for (const u of units) { %>
  - `<%= u %>`
<% } %>

## What to do

1. Call `haiku_review_open { intent: "<%= slug %>", stage: "<%= stage %>", gate_kind: "<%= gateKind %>", units: <%~ unitsJson %> }` to open the gate-bound review session. The tool returns the URL immediately and writes `gate_review_session_id` to stage state — it does NOT block; `haiku_await_gate` does the blocking + stamp work below.
2. Post the returned review URL to the user in chat — one or two sentences, no walls of text.
3. Call `haiku_await_gate { intent: "<%= slug %>" }` and block on the user's decision.
4. The await tool will return one of: `intent_approved` / `advance_phase` / `advance_stage` / `changes_requested` / `external_review_requested`. Each carries a follow-up instruction — execute it.

On approve, await_gate stamps `<%= gateKind === "spec" ? "reviews" : "approvals" %>.user` on each listed unit and the cursor on the next tick routes forward (next role / complete_stage / next stage).

On request_changes, await_gate writes the user's annotations as feedback files; the cursor on the next tick walks Track B and routes the fix loop. Do NOT manually file the feedback yourself — the review server's submission carries the structured annotations.
