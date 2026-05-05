---
name: change-mode
description: Change the execution mode of an active H·AI·K·U intent — dial up or dial back human involvement mid-flight
---

# Change Mode

Change the execution mode of an in-flight intent. Use when:

- The mode chosen at start no longer fits (e.g. `discrete` is too heavy for a small change, or `continuous` is too autonomous for high-risk work).
- A teammate picked up an intent and wants different review semantics than the original owner.
- An intent was created with the wrong mode and you need to correct it before too much state accumulates.

## Process

1. **Resolve the intent.** If no slug is in scope (current branch isn't a `haiku/<slug>/...` branch), ask which intent to change. Otherwise infer from the branch.

2. **Call `haiku_select_mode`** with the intent slug. The tool elicits a mode value from the user. It will automatically:
   - Hide `quick` from the picker if the intent has already started a stage (you cannot enter or leave `quick` mid-flight — it's single-stage by definition).
   - Hide all options except the current mode if the intent is in `quick` and has started (no transition out is allowed).
   - For non-quick destinations: write `mode` to intent.md and set `stages` to the studio's full stage list (idempotent — restoring the full list is safe even if it was already there).

3. **Drive forward.** After the mode is picked, call `haiku_run_next { intent: "<slug>" }`. The workflow engine continues from wherever the intent currently is — mode changes don't reset stage progress.

## Constraints

- **No `quick` transitions mid-flight.** Quick mode is single-stage and chosen at intent creation only. Switching into quick would amputate the rest of the workflow; switching out would suddenly add stages the user never reviewed. The engine refuses both.
- **Cannot change mode pre-studio.** If `studio` isn't set yet, the intent hasn't reached mode selection — use `/haiku:start` to drive the initial elicitation chain instead of this skill.

## Notes

- This skill never accepts a free-form mode value as an argument. Mode is engine-managed; the only way to set it is through `haiku_select_mode`'s elicitation.
- `discrete-hybrid` is a derived mode, not directly selectable. The engine computes it from `continuous` + per-stage external gates.
