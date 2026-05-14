# Close feedback `<%= fbId %>` on stage `<%= stage %>`

Every fix-hat for feedback `<%= fbId %>` has signed advance. The engine is ready to flip the FB to `closed` and continue the cursor walk.

## What to do

Call `haiku_run_next { intent: "<%= slug %>" }` — the engine writes the closure (lifecycle: closed, closed_at: now) and the next tick walks the cursor forward (next FB on Track B, or back to Track A).

Do NOT call `haiku_feedback_update` manually — the engine owns the closure timestamp and the lifecycle transition. Manual writes here will trip the workflow-managed-file guard.
