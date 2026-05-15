---
name: debug
description: Admin tools for unsticking corrupt intents — force a stage complete, set intent fields, reset drift, mutate feedback. Every mutation requires user confirmation via the SPA picker.
---

# Debug

Admin/recovery tools for intents that are corrupt, wedged, or otherwise stuck in ways the normal workflow engine can't recover from. Every mutating op routes through `haiku_debug` and surfaces a SPA picker for user confirmation before any state changes. **The agent cannot run any admin op unilaterally.**

## Two surfaces — same five ops, two ways to drive them

- **SPA admin panel** (user-driven, primary): browse to `/debug` on the
  haiku review server (default `http://127.0.0.1:7320/debug`). Pick an
  intent, see its current state + cursor preview, and run any of the
  five ops. The SPA's confirmation modal IS the elicitation gate — every
  mutation shows the exact request body before POST.
- **`haiku_debug` MCP tool** (agent-driven, fallback): the agent calls
  the tool with `op` + args. The tool routes through `runPicker` so the
  user sees the same confirmation in the picker UI before any state
  mutates. Cancellation returns `{ action: "cancelled" }` and no state
  changes.

Both surfaces call the same underlying `debug-ops.ts` functions. The
agent cannot reach the ops without an explicit user click on either
surface.

## When to use this skill

- An intent is stuck in a loop the engine's halt mechanism caught (`loop_halted` action) and the user wants to manually unblock it.
- A stage's units have moved through every hat but the cursor won't advance because reviews/approvals/quality_gates aren't stamped.
- The intent's `mode` is wrong (set to `continuous` when it should be `autopilot`, etc.) — `mode` is normally engine-managed, but mid-flight changes need an override.
- Drift sweep keeps re-firing on stale witnesses even after the underlying state matches — re-stamp every witness to the current SHA.
- A feedback record is in an impossible state (closed but resolution still null, etc.) and needs surgical FM mutation.

## When NOT to use this skill

- Use `/haiku:repair` first for the supported v4 recovery paths (drift baseline, worktree relocation, mainline PR generation).
- Use `/haiku:reset-stage` or `/haiku:reset-intent` for full destructive resets.
- For day-to-day workflow questions (why didn't this stage advance? what's the cursor doing?), `/haiku:dashboard` and reading the prompt file are usually faster.

## How to call

`haiku_debug` takes `intent` + `op` + op-specific args. Five ops:

### `preview_cursor` — read-only, no picker
What would the next `haiku_run_next` action be, given current on-disk state? Useful before any mutation to see the starting position.

```
haiku_debug({ intent: "<slug>", op: "preview_cursor" })
```

### `force_stage_complete` — sign reviews/approvals/QGs for every unit in stages up to and including target
Refuses units that haven't reached terminal hat advance (the "moved through every hat" proof).

```
haiku_debug({
  intent: "<slug>",
  op: "force_stage_complete",
  stage: "<target-stage>",
})
```

### `set_intent_field` — bypass FSM-protected fields
Primarily for `mode`. Pass any FM key + value.

```
haiku_debug({
  intent: "<slug>",
  op: "set_intent_field",
  field: "mode",
  value: "autopilot",
})
```

### `reset_drift` — re-stamp every witnessed slot with current SHA
Drift sweep stops finding mismatches after this runs.

```
haiku_debug({ intent: "<slug>", op: "reset_drift" })
```

### `mutate_feedback` — set any FB FM field set
Patch is a dict of FM keys to set. No lifecycle guards.

```
haiku_debug({
  intent: "<slug>",
  op: "mutate_feedback",
  stage: "<stage-or-omit-for-intent-scope>",
  feedback_id: "FB-037",
  patch: { status: "closed", closed_at: "2026-05-15T...", resolution: "inline_fix" },
})
```

## Confirmation flow

For every mutating op:
1. The tool calls `runPicker` with a CONFIRM picker showing the exact mutation about to happen.
2. The SPA opens. The user sees the intent name, the op, and the parameters.
3. If the user clicks "Yes, run \<op\>", the mutation runs and the result is returned.
4. If the user clicks Cancel (or closes the tab / times out), the response is `{ action: "cancelled" }` and NO state was mutated.

The agent surfaces both outcomes verbatim. Never auto-retry on cancellation — that defeats the confirmation gate.

## After running an admin op

Always call `preview_cursor` next to see the new cursor head and verify the wedge is gone. If the cursor still emits the same action that was wedged, the underlying state needs more surgery — file an issue with the preview_cursor output so the engine can be patched.
