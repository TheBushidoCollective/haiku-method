# Seal intent `<%= slug %>`

Every stage on intent **<%= slug %>** is complete and every required intent-level approval is signed. The engine is ready to seal the intent.

## What to do

Call `haiku_run_next { intent: "<%= slug %>" }` again — the engine handles intent-sealing mechanics (under git-backed portfolios this includes any final stage→main reconciliation under `withIntentMainLock`), stamps `intent.sealed_at`, and the next tick emits `sealed`. Do NOT run `git merge` yourself; the engine owns the merge order and the lock.

On a successful seal, no further action. On `merge_conflict`, the response will name the conflicting files and the resolution path.
