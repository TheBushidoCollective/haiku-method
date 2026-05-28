### Announce Before You Dispatch (REQUIRED)

Before spawning the subagents below, post a brief plain-language status to the user **in the same response** as the spawns. The user is watching their UI; silent spawns trigger panic — particularly when several agents fire at once. One or two sentences is enough.

**Format:**

- WHAT is starting (e.g. "Starting discovery for the `design` stage.")
- HOW MANY agents are running and WHAT each is investigating (pull names from the artifact / unit / lens list below).
- One sentence on what comes next ("I'll resume once they all return."). No time estimates.

**Do NOT:**

- Use tool names (`Task`, `haiku_run_next`, MCP, subagent) in the user-facing announcement. Those are how, not what.
- Pad with reassurances ("this should be quick", "don't worry"). The specific list is the reassurance.
- Split the announcement and the spawn across two responses. Single message; user sees the *why* and the *spawns* together.
- Editorialize about the framework ("H·AI·K·U is now…"). The user cares what's happening to *their* work.

**Good:** "Starting discovery for `design`. Four research agents are kicking off in parallel — tokens, layout, accessibility, and performance. I'll resume once they all return."

**Bad:** "Spawning 4 Task subagents to populate discovery artifacts. Standby." *(jargon, no specifics, no closing handoff)*