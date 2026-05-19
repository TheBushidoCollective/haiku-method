<%= header %>

<%= message %>
<% if (pendingItems.length > 0) { %>

### Still-pending feedback

<% for (const p of pendingItems) { %>
- **<%= p.feedback_id %>** — <%= p.title %>
<% } %>
<% } %>

### STOP

**Do NOT call `haiku_run_next` again.** The autonomous loop is halted by design — <%= capLine %>. Repeated bolts converging on the same surface fix is exactly what the cap exists to catch; another bolt without a different root-cause hypothesis will fail the same way. Surface this to the user and wait for them to choose:

1. <%~ rejectExample %>
2. File a stage_revisit feedback at the target stage via `haiku_feedback({ intent, stage: "<target-stage>", resolution: "stage_revisit", title, body })` and call `haiku_run_next` — the pre-tick feedback walk reroutes through that stage (uncapped, user-invoked)
3. Terminate the intent or mark the stage complete manually
4. Adjust the unit spec or criteria if the finding set is genuinely unreachable
<% if (isIntentScope) { %>
5. Edit the studio fix-hat mandates if the hats are structurally unable to close this class of finding
<% } %>

Report the situation and the options above. Do NOT decide autonomously.
