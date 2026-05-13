---
name: revisit
description: Route the agent back to an earlier stage to address issues found during execution
---

# Revisit

When the user wants to address something at a stage that's already past, log one or more `stage_revisit` feedback items at the target stage and call `haiku_run_next`. The cursor's feedback walk finds the open FB at that earlier stage and emits `start_feedback_hat` for the stage's fix-hat sequence. The post-cursor branch switch routes the agent to that stage's branch automatically.

## Process

1. **Find the active intent.** Call `haiku_intent_list`. If multiple are active, ask the user which one.

2. **Confirm target stage and reasons.** Ask the user (a) which stage to revisit (default: the current active stage — under v4 derived from the cursor walk as the first stage that isn't fully complete on disk) and (b) what should change. Each reason becomes one feedback item — short, actionable, scoped to a single concern.

3. **Log a stage_revisit feedback for each reason.** For each reason:

   ```
   haiku_feedback {
     intent: "<slug>",
     stage: "<target-stage>",
     title: "<one-line summary>",
     body: "<what's wrong, what should change, any file:line refs>",
     origin: "agent",
     resolution: "stage_revisit"
   }
   ```

   The `resolution: "stage_revisit"` annotates the FB's intent; the cursor's feedback walk picks up any open FB at the target stage and routes the agent there regardless of resolution. The resolution value is preserved for the audit trail and for the SPA to render the "request changes" path correctly.

4. **Drive the lifecycle.** Call `haiku_run_next { intent: "<slug>" }`. The cursor walks the feedback track across all stages ≤ current, finds the open FB at the target stage, and emits `start_feedback_hat`. The post-cursor branch switch routes the agent to the target stage's branch. The fix-hat sequence runs against each FB.

## Why this shape

- **One pattern, not two.** Every "I want to change the workflow" expression — agent-blocked, reviewer-rejected, user-typed — flows through the same surface: write a feedback finding, call run_next, the feedback walk routes. There is no separate "revisit verb" or distinct cursor action.
- **Audit trail.** Each reason becomes a durable on-disk feedback record showing exactly why the rewind happened and what needs to change. Future debugging gets the full why.
- **Consistent with the agent's contract.** The agent's universe is "receive instruction, do what it says, call run_next" — no extra workflow-routing tools.

## Quick reference

| What you want | Tool calls |
|---|---|
| User wants to revisit current stage | `haiku_feedback {..., resolution: "stage_revisit"}` × N → `haiku_run_next` |
| User wants to revisit an earlier stage | `haiku_feedback {stage: "<earlier>", ..., resolution: "stage_revisit"}` × N → `haiku_run_next` |
| Agent is blocked, needs upstream rework | Same — log a stage_revisit FB at the upstream stage, call run_next |

## Limitations

`/haiku:revisit` routes the agent and runs the fix-hat sequence against the FB. It does NOT:

- Clear the target stage's prior approval stamps (the fix-hat may invalidate specific roles via `targets.invalidates`, but global approval reset is the per-stage reset job).
- Reset the target stage's elaboration / discovery / units. If you fixed the studio hat instructions and want the stage to re-run cleanly from elaborate, that's `/haiku:reset-stage` (per-stage reset).
- Rewind merge state. Stages already merged into intent main stay merged; new work supersedes the prior approval via the fix-hat's invalidation contract.

If you need a full stage rewind (re-elaborate, re-decompose, re-execute), use `/haiku:reset-stage`. If the whole intent's premise was wrong from the start, use `/haiku:reset-intent` instead.
