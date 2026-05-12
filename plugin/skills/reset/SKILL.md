---
name: reset
description: Reset an intent or a single stage — wipe state and let the engine re-run it from scratch
---

# Reset

Two scopes:

- **Full intent reset** — wipe every stage, every branch, every artifact. Used when the intent's premise was wrong from the start and the user wants to recreate from the same description.
- **Per-stage reset** — wipe one stage (its units, outputs, artifacts, elaboration, feedback, stage branch). Used when the stage's hat instructions or studio config got fixed and the user wants the agent to re-run just that stage cleanly. Other stages stay put.

## Full intent reset

1. Call `haiku_intent_list` to find the intent. If multiple are active, ask the user which one.
2. Call `haiku_intent_reset { intent: "<slug>" }`. The tool confirms via the SPA picker, preserves the title and description, and returns instructions to recreate.
3. Follow the returned instructions to call `haiku_intent_create` with the preserved `title` and `description`. If the preserved title looks auto-truncated (ends in `…` or is a mid-sentence fragment), rewrite it as a crisp 3–8 word summary before calling — don't re-save a broken title.

## Per-stage reset

When the user says "reset the product stage" (or similar — one stage by name):

1. Call `haiku_stage_reset { intent: "<slug>", stage: "<stage-name>" }`. The tool confirms via the SPA picker and lists what's about to be deleted.
2. After the user confirms, the tool deletes the stage's `units/`, `outputs/`, `artifacts/`, `feedback/`, `elaboration.md`, `decisions.jsonl`, the agent-produced `discovery/*.md` outputs (templates preserved), and the stage's git branch. Other stages stay untouched.
3. The tool returns a message saying to call `haiku_run_next` — the next tick re-enters the stage at its elaborate phase. The agent picks up the conversation and re-runs the stage's hat sequence.

## When to use which

- **Full reset**: the intent's *description* was wrong. The user wants to start from a clean slate with the same title.
- **Per-stage reset**: the intent is fine, but a specific stage produced output that no longer matches what the user wants (because the studio's hat instructions, review-agents, or stage config were updated since the stage ran). The user fixed the config and wants the agent to redo just that stage with the new instructions.

## What per-stage reset does NOT do

- It does NOT rewind intent main's git history. If the stage was previously merged into intent main, those commits stay in history. The stage's new work supersedes via the normal merge path (the next merge from stage → intent main reconciles the two views).
- It does NOT touch other stages. Their units, outputs, approvals, and branches are unaffected.
- It does NOT remove the stage from the intent's declared `stages:` list. The stage still exists as a workflow phase; it just starts over.

If you need to rewind intent main itself, that's a manual `git revert` / `git reset` — not in scope for this skill.
