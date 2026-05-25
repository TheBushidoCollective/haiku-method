---
name: haiku-autopilot
description: Full autonomous workflow — elaborate, plan, build, review, and deliver in one command
---

# Autopilot

Run the full H·AI·K·U lifecycle autonomously from description to delivery. Autopilot is one of the three intent modes (`discrete | continuous | autopilot`). It tells the workflow engine to promote `ask` review gates to `auto`, so the lifecycle advances without human intervention on stage gates. External gates and the intent-completion review still pause (structural signals the workflow engine can't synthesize).

## Process

1. **If no active intent exists**, create one with `/haiku:haiku-start`, then set autopilot with `haiku_select_mode { intent: "<slug>", modes: ["autopilot"] }`. Passing a single mode auto-selects it (no picker pause) and writes `mode: autopilot` plus the studio's full stage list. Do NOT pass `mode` to `haiku_intent_create` — studio/mode/stage are engine-managed and start unset.
2. **For an existing intent**, set the mode with `haiku_select_mode { intent: "<slug>", modes: ["autopilot"] }` — a single-option list auto-selects with no picker pause and writes `mode` (+ stages) through the one engine-sanctioned path. Do NOT use `haiku_intent_set { field: "mode" }` or `haiku_human_write` — `mode` is an engine-managed field that both reject (`intent_field_engine_only`); `haiku_select_mode` is the ONLY mode setter. Do NOT set a separate `autopilot: true` boolean — that is a deprecated pattern. (If the intent has already started a stage, `select_mode` refuses transitions into/out of `quick`; surface that to the user.)
3. **Optional: skip the final intent review** by calling `haiku_intent_set { intent: "<slug>", field: "intent_completion_review", value: false }`. Do NOT set this unless the user explicitly wants truly headless completion; the completion review is the bookend that prevents silent intent-completion on stage-gate pass.
4. **Drive the loop** by calling `haiku_run_next { intent: "<slug>" }`. Repeat on every return. When a subagent returns, re-call `haiku_run_next` to advance.

## What still pauses autopilot

- **External gates** (`external` or compound `[external, ask]`). They need a real PR/MR merge signal and cannot be auto-approved.
- **`await` gates.** Waiting for a non-review external event (customer response, pipeline, etc.).
- **Elicitation-required decisions.** Design-direction picks, visual approvals.
- **Scope explosions** (see guardrails below).
- **Intent-completion review** (unless `intent_completion_review: false` is set on the intent).

## Guardrails

- **Pause on blockers or ambiguity.** If the workflow engine returns an error or a decision that can't be inferred from the intent's goals, stop and surface it to the user. Never guess.
- **Pause on scope explosion.** If elaborate produces more than 5 units in a single stage, stop and ask the user to confirm scope — that's a signal the task is bigger than it looked and autopilot may not be appropriate.
- **Pause before mid-workflow PR creation.** When `haiku_run_next` returns `external_review_requested` mid-lifecycle (e.g. per-unit MRs in discrete mode), surface the PR creation step to the user — don't open PRs autonomously. The final intent-completion delivery PR is the exception: after `intent_complete`, open the delivery PR (`haiku/<slug>/main` → `main`) directly. The intent-completion review gate is the human checkpoint; pausing again is redundant.
- **Stop on phase-level failures.** `error`, `max_bolts_exceeded`, `unit_scope_violation` not clearable after one retry, or any workflow engine rejection that persists across two calls → stop and report.

## Combined with other skills

- `/haiku:haiku-quick` + autopilot: set `stages: [<one>]` AND `mode: autopilot`. Single-stage, no pauses except external/completion gates.
- Filing a stage_revisit feedback while in autopilot: the resulting feedback walk pauses autopilot at the target stage until the user confirms the corrective work.
