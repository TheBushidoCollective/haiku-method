## Safe Intent Repair

<%= message %>
<% if (synthesizedStages.length > 0) { %>

**Synthesized stages:** <%= synthesizedStages.join(", ") %>
<% } %>
<% if (phaseWasRegressed) { %>

**Phase regressed:** The active stage was regressed from `execute` to `elaborate` because some units are missing `inputs:` declarations. Address the missing inputs before proceeding.
<% } %>

### Instructions

Resolve any stages needing manual review, then call `haiku_run_next { intent: "<%= slug %>" }` again.
