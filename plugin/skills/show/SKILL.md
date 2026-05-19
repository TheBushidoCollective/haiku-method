---
name: show
description: Open the SPA review pane for an intent so the user can browse units, feedback, stage artifacts, and outputs. Non-blocking on the workflow — leaves feedback that the engine picks up on the next tick. Use whenever the user wants to "see," "open," "show," or "look at" the current intent or a specific stage.
---

# Show

Open the ad-hoc review pane for the active intent.

## What this does

Calls `haiku_review_open` (NOT `haiku_review` — that's the diff-review workflow at `/haiku:gate-review`). The tool spawns a session-scoped review URL pointing at the SPA, launches the browser, and BLOCKS until the user clicks Done / Request Changes or the 30-minute timeout fires. The pane is ad-hoc — it shows the standard review UI but swaps Approve for Done/Close so it never accidentally mutates workflow state.

Feedback the user leaves on the pane routes through the normal fix-loop on the next `haiku_run_next`. Closing with "Done" returns "no changes requested"; "Request Changes" returns a nudge to run the workflow forward so the durable feedback gets picked up.

## How to invoke

Default — opens against the auto-resolved active intent (the current git branch's intent, or the single non-completed intent in `.haiku/intents/` when there's exactly one):

```
haiku_review_open()
```

With explicit intent (when the user names one in the slash command, or when the branch doesn't match):

```
haiku_review_open({ intent: "<slug>" })
```

With explicit stage (to land directly on that stage without making the user navigate):

```
haiku_review_open({ intent: "<slug>", stage: "<stage>" })
```

## Argument parsing

The skill argument is free-form text. Common shapes the user might pass:

- `/haiku:show` — no args, auto-resolve intent
- `/haiku:show <intent-slug>` — open that intent
- `/haiku:show <intent-slug> <stage>` — open that intent and land on that stage
- `/haiku:show <stage>` — when only one active intent exists, treat as a stage hint

Parse positionally. If the first token matches a known intent slug in `.haiku/intents/`, use it as `intent`; otherwise treat it as `stage`. The second token (if present) is always `stage`.

## Don't confuse with

- `/haiku:gate-review` — multi-agent code-review-of-the-diff workflow, not the SPA pane. Calls `haiku_review`, not `haiku_review_open`.
- `/haiku:dashboard` — text-only summary of active intents, doesn't open the SPA.
- `/haiku:pickup` — drives the workflow forward to the next gate; this skill is browse-only.
