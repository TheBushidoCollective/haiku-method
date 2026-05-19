<% if (studioBody) { %>
### Studio: <%= studio %>

<%~ studioBody %>

<% } %>
## Stage: <%= stage %>

Hats: <%= hats.join(" -> ") %>
<% if (stageBody) { %>

### Stage Definition

<%~ stageBody %>
<% } %>
<% if (follows) { %>

### Follow-up Context

This intent follows "<%= follows %>". Load parent knowledge artifacts: <%~ parentKnowledgeJson %>
<% } %>

### Instructions

Stage has been started by the orchestrator (status: active, phase: elaborate).

<% if (follows) { %>
1. Load parent knowledge via `haiku_knowledge_read` for each file in parent_knowledge
2. Call `haiku_run_next { intent: "<%= slug %>" }` to get the next action
<% } else { %>
1. Call `haiku_run_next { intent: "<%= slug %>" }` to get the next action
<% } %>
