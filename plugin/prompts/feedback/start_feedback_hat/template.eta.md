<% if (dispatchCount === 0) { %>
## start_feedback_hat: no FBs

The cursor returned start_feedback_hat with no dispatches. Call `haiku_run_next { intent: "<%= slug %>" }` to retick.
<% } else { %>
# Dispatch <%= dispatchCount %> fix-hat subagent<%= plural %>

Open feedback items ready for their next fix-hat. Each entry below is INDEPENDENT — different feedback IDs, potentially different stages, potentially different hats. Spawn ONE subagent per entry, in parallel, in a single message with <%= dispatchCount %> `Task` call<%= plural %>.

<% for (const d of dispatches) { %>
  - `<%= d.feedback_id %>` → stage `<%= d.stage || "(intent)" %>`, hat `<%= d.hat %>`<% if (d.terminal) { %> (terminal)<% } %>
<% } %>

## What to do

<%= batchDirective %>

Each subagent block below carries its own (stage, hat, feedback_id) — read the block carefully; do NOT assume the prior subagent's stage or hat apply to the next one.

The MCP tools require an integer for `feedback_id` (e.g. `feedback_id: 1`). `feedback_id: "FB-001"` (string) is rejected at the AJV gate with `<tool>_input_invalid`. Pass the integer literal as written in each block; do not requote, prefix, or zero-pad.

<% dispatches.forEach((d, i) => { %>
### Subagent <%= i + 1 %> of <%= dispatchCount %> — `<%= d.feedback_id %>` (stage `<%= d.stage || "(intent)" %>`, hat `<%= d.hat %>`)

<% if (d.model_tier) { %>
**Model:** spawn this Task with `model: "<%= d.model_tier %>"` (resolved from the cascade — source: <%= d.model_source %>).

<% } %>
```
<% if (d.hat_path) { %>Read <%= d.hat_path %>.<% } else { %>Read the `<%= d.hat %>` hat mandate (no on-disk file resolved for studio/stage/hat — engine bug; proceed from prior context).<% } %>
Then call haiku_feedback_read { intent: "<%= slug %>", stage: "<%= d.stage %>", feedback_id: <%= d.fb_int %> } to load the FB body.
Execute the <%= d.hat %> mandate against the FB.
When done, call ONE of THREE:
  (A) Success — work completed, route to next hat:
    haiku_feedback_advance_hat { intent: "<%= slug %>", stage: "<%= d.stage %>", feedback_id: <%= d.fb_int %><% if (d.terminal) { %>, reply: "<short plain-language explanation of what was done — surfaces in the SPA so the requester sees the resolution>"<% } %> }
  (B) Hat-block — THIS hat can't do its work but the finding may still be valid (re-dispatches the prior hat on a new bolt):
    haiku_feedback_reject_hat { intent: "<%= slug %>", stage: "<%= d.stage %>", feedback_id: <%= d.fb_int %>, reason: "<why this hat couldn't do it — e.g. needs upstream classification first>" }
  (C) Invalid finding — the finding ITSELF is wrong (TERMINAL closure, no further dispatch, FB is done):
    haiku_feedback_reject { intent: "<%= slug %>", stage: "<%= d.stage %>", feedback_id: <%= d.fb_int %>, reason: "<why this finding is invalid — e.g. cosmetic drift, false-positive, already addressed in sealed artifact>" }
Terminate with the tool's plain-text return.

⟁ CLOSURE REQUIRED. You MUST end with one of advance_hat / reject_hat / reject. Terminating without one is a contract violation — the cursor will see your subagent vanish without stamping iteration state and re-dispatch the same hat indefinitely. Silence is never the right exit.

⟁ PICK THE RIGHT EXIT (reject_hat ≠ reject — this is a footgun the 2026-05-18 haiku-loop-bug traced multiple bolt-cap loops to):
  • reject_hat keeps the FB OPEN, bumps the bolt counter, and re-dispatches the chain. Use ONLY when this hat physically can't complete its work but a different hat might. The bolt cap (3) eventually escalates if the chain can't converge.
  • reject CLOSES the FB terminally with the reason. Use when the finding itself is wrong: cosmetic drift, false-positive, already-addressed-in-sealed-artifact, witness-stale-from-migration, etc. Don't burn bolts on an invalid finding — close it once.
If you're rejecting because the finding is wrong, use reject. If you're rejecting because YOUR hat is wrong for this finding, use reject_hat.
```
<% if (d.terminal) { %>

**Terminal hat note for `<%= d.feedback_id %>`**: `<%= d.hat %>` is the LAST hat in stage `<%= d.stage %>`'s `fix_hats:` sequence. The subagent's `feedback_advance_hat` call closes the FB (stamps `closed_at`) and applies `targets.invalidates` to the targeted unit's approvals — the cursor on the next tick will route through the invalidated roles to re-run them.

**Reply required**: pass a `reply` string with a short plain-language explanation of what was done. Without it, `haiku_feedback_advance_hat` returns `reply_required` and refuses to close.
<% } %>

<% }) %>
After all <%= dispatchCount %> subagent<%= plural %> return, call `haiku_run_next { intent: "<%= slug %>" }`.

<%~ fixLoopContractsBlock %>
<% } %>
