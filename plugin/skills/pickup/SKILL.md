---
name: pickup
description: Resume an active H·AI·K·U intent — pick up where you left off
---

# Resume an Intent

## Process

1. **Advance the lifecycle** — Call `haiku_run_next { pickup: true }`. The `pickup: true` flag tells the engine to fetch origin and materialize the active stage branch locally so the in-flight unit work is recoverable. The workflow engine also resolves the intent automatically:
   - If you're on a `haiku/<slug>/main` or `haiku/<slug>/<stage>` branch → uses that slug.
   - If there's exactly one active intent on disk → uses it.
   - If there are multiple and no branch match → the tool returns the list of slugs for you to disambiguate, then re-call with `haiku_run_next { intent: "<slug>", pickup: true }`.

2. **Follow the instructions** — The tool returns the next action and detailed instructions. Execute them.

## Notes

- If no active intents exist, suggest starting a new one with `/haiku:start`
- The `haiku_run_next` tool handles all workflow engine logic AND intent resolution — no intent-list call needed in the common case.
- The pickup hint at the top of the response names the active stage branch. Run `git switch <branch>` only if you want to inspect in-flight unit work directly; the engine drives the workflow from intent main and doesn't need you on the stage branch.
