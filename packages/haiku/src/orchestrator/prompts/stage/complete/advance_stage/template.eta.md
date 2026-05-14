## Advance Stage

Gate passed. The orchestrator has advanced from "<%= stage %>" to "<%= nextStage %>".

**Call `haiku_run_next { intent: "<%= slug %>" }` immediately.** Do NOT ask the user for confirmation — the gate was already approved. Do NOT present summaries or ask "want me to continue?" — just call the tool.
