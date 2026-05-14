<% if (feedbackCount === 0) { %>
## start_feedback_hat: no FBs

The cursor returned start_feedback_hat with no feedback_ids. Call `haiku_run_next { intent: "<%= slug %>" }` to retick.
<% } else { %>
# Dispatch fix-hat `<%= hat %>` for feedback on `<%= stage %>`

Open feedback needing the `<%= hat %>` hat:

<% for (const id of feedbackIds) { %>
  - `<%= id %>`
<% } %>

## What to do

Spawn <%= feedbackCount %> subagent<%= plural %> (parallel, single message, <%= feedbackCount %> `Task` call<%= plural %>). Each subagent block below carries the **numeric FB ID** inlined into every tool call (e.g. `feedback_id: 1`). The MCP tools require an integer here — `feedback_id: "FB-001"` (string) is rejected at the AJV gate with `<tool>_input_invalid`. Pass the integer literal as written; do not requote, prefix, or zero-pad.

<% if (modelTier) { %>
**Model:** spawn each Task with `model: "<%= modelTier %>"` (resolved from the cascade — source: <%= modelSource %>). Mechanical fix-hat work doesn't need Opus; the studio's `default_model: <%= modelTier %>` keeps cost per fix bounded. Per-FB or per-hat `model:` overrides escalate when a particular fix needs more capability.

<% } %>
<% feedbackIds.forEach((fbId, i) => { const fbNum = fbInts[i] %>
### Subagent for `<%= fbId %>`

```
Read plugin/studios/<studio>/stages/<%= stage %>/hats/<%= hat %>.md.
Then call haiku_feedback_read { intent: "<%= slug %>", stage: "<%= stage %>", feedback_id: <%= fbNum %> } to load the FB body.
Execute the <%= hat %> mandate against the FB.
When done, call ONE of:
  Success path:
    haiku_feedback_advance_hat { intent: "<%= slug %>", stage: "<%= stage %>", feedback_id: <%= fbNum %><% if (terminal) { %>, reply: "<short plain-language explanation of what was done — surfaces in the SPA so the requester sees the resolution>"<% } %> }
  Block / reject path:
    haiku_feedback_reject_hat { intent: "<%= slug %>", stage: "<%= stage %>", feedback_id: <%= fbNum %>, reason: "<why>" }
Terminate with the tool's plain-text return.
```

<% }) %>
<% if (terminal) { %>
**Terminal hat note**: `<%= hat %>` is the LAST hat in this stage's `fix_hats:` sequence. The subagent's `feedback_advance_hat` call closes the FB (stamps `closed_at`) and applies `targets.invalidates` to the targeted unit's approvals — the cursor on the next tick will route through the invalidated roles to re-run them.

**Reply required**: pass a `reply` string with a short plain-language explanation of what was done. Without it, `haiku_feedback_advance_hat` returns `reply_required` and refuses to close. The reply surfaces in the SPA so the requester sees the resolution, not just that closure happened.

<% } %>
After all subagent(s) return, call `haiku_run_next { intent: "<%= slug %>" }`.
<% } %>
