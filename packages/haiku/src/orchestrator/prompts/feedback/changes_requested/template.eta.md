## Changes Requested

<%= message %>
<% if (annotations && annotations.length > 0) { %>

### Annotations

<% for (const a of annotations) { %>
- <% if (a.path) { %>**<%= a.path %>:** <% } %><%= a.body || "" %>
<% } %>
<% } %>

### Instructions

Address each piece of feedback, then call `haiku_run_next { intent: "<%= slug %>" }` to re-submit for review.
