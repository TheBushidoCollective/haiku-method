<% if (phase === "post") { %>
# Rewrite the stage brief for `<%= stage %>` (post-execute, before the stage closes)

Stage `<%= stage %>` has finished building: every unit is approved and the quality gates have run. Before the stage closes, one briefer subagent rewrites the user-facing `BRIEF.md` — flipping it from "this is what I am going to do" to "this is what I did" so the human sees an honest summary of the work that actually landed.

## What to do

Spawn the briefer subagent below (single Task call). Its full prompt — what to read, what to write, who it's for — is in the file referenced by the `<subagent>` block; pass that block verbatim to the Task tool.

<%~ dispatchBlock %>

When the briefer terminates, call `haiku_run_next { intent: "<%= slug %>" }`. The cursor closes the stage once the closing brief is finalized.
<% } else { %>
# Write the stage brief for `<%= stage %>` (pre-execute, before the user gate)

The spec for stage `<%= stage %>` has passed adversarial review. Before the user gate opens, one briefer subagent writes the user-facing `BRIEF.md` — a plain-language summary of what this stage is about to build, written for the human who's about to review the plan.

## What to do

Spawn the briefer subagent below (single Task call). Its full prompt — what to read, what to write, who it's for — is in the file referenced by the `<subagent>` block; pass that block verbatim to the Task tool.

<%~ dispatchBlock %>

When the briefer terminates, call `haiku_run_next { intent: "<%= slug %>" }`. The cursor routes to the review user gate once `BRIEF.md` exists (or straight to execution when the stage has no gate).
<% } %>
