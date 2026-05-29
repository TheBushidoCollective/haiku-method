# Write the stage brief for `<%= stage %>` (pre-execute, before the user gate)

The spec for stage `<%= stage %>` has passed adversarial review. Before the user gate opens, one briefer subagent writes the user-facing `BRIEF.md` — a plain-language summary of what this stage is about to build, written for the human who's about to review the plan.

## What to do

Spawn the briefer subagent below (single Task call). Its full prompt — what to read, what to write, who it's for — is in the file referenced by the `<subagent>` block; pass that block verbatim to the Task tool.

<%~ dispatchBlock %>

When the briefer terminates, call `haiku_run_next { intent: "<%= slug %>" }`. The cursor routes to the review user gate once `BRIEF.md` exists (or straight to execution when the stage has no gate).
