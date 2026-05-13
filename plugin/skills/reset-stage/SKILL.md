---
name: reset-stage
description: Wipe a single stage of an intent (its units, outputs, artifacts, elaboration, feedback, and stage branch) so the agent can re-run it from scratch. Other stages stay untouched. For wiping the whole intent, use /reset-intent.
---

# Reset Stage

Wipe ONE stage of an intent and let the engine re-enter it at the elaborate phase on the next tick. The intent's other stages, their approvals, and intent main's history all stay put.

## When to use this skill

The intent is fine, but a specific stage produced output that no longer matches what the user wants — usually because the studio's hat instructions, review-agents, or stage config were updated *after* the stage ran, and the user wants the agent to redo just that stage with the new instructions.

**Not the right tool when:**
- The intent's whole premise was wrong from the start — that's `/reset-intent`.
- The stage's output has a few specific problems the user wants flagged — that's a feedback revisit, not a reset.
- The user wants to roll back intent main's git history — that's a manual `git revert` / `git reset`, not in scope for this skill.

## How to drive it

When the user says "reset the product stage" (or names one stage):

1. **Identify the intent.** If no intent slug is known from context, call `haiku_intent_list` first. If multiple are active and the user didn't name one, ask which intent before proceeding — the same discovery preflight `/haiku:reset-intent` does.
2. Call `haiku_stage_reset { intent: "<slug>", stage: "<stage-name>" }`. The tool confirms via the SPA picker and lists what's about to be deleted.
3. After the user confirms, the tool performs the wipe (details below).
4. The tool returns a message saying to call `haiku_run_next` — the next tick re-enters the stage at its elaborate phase. The agent picks up the conversation and re-runs the stage's hat sequence.

## What gets wiped

- `stages/<stage>/units/*.md`
- `stages/<stage>/outputs/`, `artifacts/`, `decisions.jsonl`
- `stages/<stage>/elaboration.md`
- `stages/<stage>/feedback/*.md`
- `stages/<stage>/discovery/` *contents* (the studio's template files are kept; the agent's produced outputs are wiped)
- The stage's git branch (`haiku/<slug>/<stage>`). The next `haiku_run_next` forks it from intent main as needed.

## What stays

- `intent.md` (the whole intent's identity, including approval stamps that belong to OTHER stages).
- Intent main's commits — the stage's prior merge into main stays in history. The stage's new work supersedes via the normal merge path; the next merge from stage → intent main reconciles the two views.
- Other stages' state: units, outputs, approvals, branches — all untouched.
- The stage's *declaration* in the intent's `stages:` list. The stage still exists as a workflow phase; it just starts over.
