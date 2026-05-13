---
name: reset-intent
description: Wipe an entire intent (every stage, every branch, every artifact) and prepare to recreate it from the preserved title and description. Use when the intent's premise was wrong from the start. For wiping a single stage only, use /reset-stage.
---

# Reset Intent

Wipe an entire intent — every stage, every branch, every artifact — and prepare to recreate it from a clean slate. The intent's title and description are preserved so the user doesn't have to retype them.

## When to use this skill

The intent's *description* was wrong, or the studio choice was wrong, or something foundational went off-track at the elaborate-or-earlier phase and the user wants to start over with the same title.

**Not the right tool when:**
- One specific stage produced output the user doesn't like — that's `/reset-stage`. Other stages stay intact.
- The user wants to keep the intent's work but rewind a hat sequence — that's a feedback revisit, not a reset.
- The intent is fine and the user just wants to discard mid-flight edits — that's `git reset` / `git restore`, not a workflow reset.

## How to drive it

1. Call `haiku_intent_list` to find the intent. If multiple are active, ask the user which one.
2. Call `haiku_intent_reset { intent: "<slug>" }`. The tool confirms via the SPA picker, preserves the title and description, and returns instructions to recreate.
3. Follow the returned instructions to call `haiku_intent_create` with the preserved `title` and `description`. If the preserved title looks auto-truncated (ends in `…` or is a mid-sentence fragment), rewrite it as a crisp 3–8 word summary before calling — don't re-save a broken title.

## What gets wiped

- Every `stages/<stage>/` directory under the intent.
- Every `haiku/<slug>/*` git branch (stage branches and intent main).
- Every artifact, feedback file, decision log, drift snapshot, and elaboration record under the intent dir.
- The intent's tracking row in any per-project state.

## What stays

- The intent's preserved title and description (returned by the tool for the recreate call).
- Other intents in the project. This skill is scoped to a single intent.
- The repo's mainline branch and history.

## After reset

The engine has nothing to tick on — `haiku_run_next` will report no active intent until `haiku_intent_create` runs. Recreate the intent immediately to keep the workflow alive.
