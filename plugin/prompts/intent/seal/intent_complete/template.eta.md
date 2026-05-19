## Intent Complete

All stages are done for intent "<%= slug %>". The orchestrator has marked it as completed.

### Instructions

<% if (gitMode) { %>
1. Report completion summary to the user
2. Open ONE merge request from branch `haiku/<%= slug %>/main` to `<%= mainline %>` for final delivery
3. Include the H·AI·K·U browse link in the description so reviewers can see the intent, units, and knowledge artifacts
4. Record the review URL via `haiku_run_next { intent: "<%= slug %>", external_review_url: "<url>" }`
<% } else { %>
Report completion summary to the user.
<% } %>
