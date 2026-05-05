---
name: quick
description: Quick mode for small tasks — single-stage intent with auto-advance
---

# Quick Mode

A quick task is a regular intent in `quick` mode (single-stage). The workflow engine's elicitation chain handles studio + stage selection; the only difference vs `/haiku:start` is that mode is locked to `quick` (skipping the mode-elicit step).

## Process

1. **Prelaborate briefly.** If the task description is vague, ask ONE clarifying question via `AskUserQuestion` with `options[]`. Otherwise skip.
2. **Create the intent** with `haiku_intent_create`:
   - `title`: 3–8 words, ≤80 chars, single line. NOT a truncated description. Good: `"Fix login button padding"`. Bad: `"Fix login button padding on mobile because…"`
   - `description`: 2–5 sentences of context.
   - **Do NOT pass `mode` or `stages`** — engine-managed. The tool will reject them.
3. **Drive the lifecycle** by calling `haiku_run_next { intent: "<slug>" }`. The workflow engine routes to `select_studio` first; the agent calls `haiku_select_studio`.
4. **After studio is selected**, the engine routes to `select_mode`. Call `haiku_select_mode { intent: "<slug>", options: ["quick"] }` — passing `options: ["quick"]` locks the mode without showing the picker (this is the only thing that distinguishes `/haiku:quick` from `/haiku:start`).
5. **The engine then routes to `select_stage`.** Call `haiku_select_stage { intent: "<slug>" }` — this elicits a single stage from the studio's stage list.
6. **Drive forward.** Each subsequent `haiku_run_next` advances through the pre-stage intent review and into the chosen stage.

## Guardrails

- If the task needs multiple stages, stop and suggest `/haiku:start` instead — don't cram it into a single stage.
- The agent NEVER passes `mode` or `stages` directly to `haiku_intent_create`. Both are engine-controlled.
- The user picks the stage via `haiku_select_stage`'s elicit — the agent does not pre-fill it unless the user already explicitly chose one in conversation, in which case pass `options: ["<chosen-stage>"]`.
