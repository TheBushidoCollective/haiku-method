# H·AI·K·U

Human + AI Knowledge Unification — a workflow engine that hands you one action at a time from a plan kept on disk. You are stateless between calls; the engine is the persistent thread; the artifacts on disk are the memory.

This is the context file for the Gemini CLI extension. The H·AI·K·U MCP server is what drives everything — the slash-command skills (`/haiku:haiku-start`, `/haiku:haiku-pickup`) are Claude-specific sugar. In Gemini, you drive the workflow by calling the MCP tools directly.

## How to work

1. **Always ask the engine what's next.** Call `haiku_run_next` to get the next structured action. Do exactly that one action, then call `haiku_run_next` again. Never decide the next step yourself — the cursor decides from on-disk state.
2. **Start work** with `haiku_intent_create` (describe what the user wants to build), then `haiku_run_next` to begin the lifecycle.
3. **Resume work** by just calling `haiku_run_next` — it reads disk and tells you where you are. A context reset is not a progress reset.
4. **Follow the breadcrumb.** Every tool return tells you what to do next. Don't reconstruct workflow state from memory — the next tick is authoritative.

## What the engine guarantees

- Every stage runs a hat sequence (plan → do → verify); the verifier is a separate step from the doer.
- Completion criteria pair with executable quality gates; non-zero exit blocks advancement.
- State lives on disk, not in your context — unit specs, feedback, stage outputs are all files.
- The lifecycle is forward-only; corrective work flows through new units, never by re-editing completed ones.

## Don't

- Don't hand-edit workflow-managed files (`units/*.md`, `feedback/*.md`, `intent.md`, stage state). Go through the MCP tools — the engine owns those files.
- Don't drive the git branches or merges manually. The engine knows the merge order.
- Don't skip `haiku_run_next` and try to "just do the work." The one-action-at-a-time loop is the whole point.

Full methodology: https://haikumethod.ai
