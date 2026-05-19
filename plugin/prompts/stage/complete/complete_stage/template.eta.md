# Complete stage `<%= stage %>`

Every unit on stage `<%= stage %>` has its required reviews + approvals stamped. The cursor is ready to mark the stage complete and advance.

## What to do

Call `haiku_run_next { intent: "<%= slug %>" }` again — the engine handles stage-completion mechanics (under git-backed portfolios this includes merging `haiku/<%= slug %>/<%= stage %>` → `haiku/<%= slug %>/main`; under filesystem-only backings it just transitions the stage state) and returns the next instruction. Most commonly: a `complete_stage` for the next finished stage, or `intent_review` once every stage is complete.

On success, no further action from you. On conflict (git backings), the response will include the conflicting files and recovery instructions.
