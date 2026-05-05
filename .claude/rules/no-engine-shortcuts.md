# No Engine Shortcuts

This plugin is what we ship to other users. They don't have the luxury of reading the workflow-engine source the way we do — they only get what the engine surfaces to them. So we don't take shortcuts that depend on source-level knowledge, even when we can.

## The rule

When the workflow engine returns an error, gets stuck, or behaves in a way that looks broken:

1. **Diagnose the engine bug first.** Read the relevant source file, identify the bug, and write the fix in the engine code (`packages/haiku/src/orchestrator/**`).
2. **Let the engine recover the workflow state itself.** After the engine fix lands and the MCP runtime is restarted, call `haiku_run_next` and let the engine's recovery paths drive the lifecycle forward.
3. **Do NOT work around the engine with manual git operations** — `git reset --hard`, manual `git merge` of unit/stage branches, hand-editing `state.json`, hand-resolving conflicts the engine should handle, etc. These shortcuts work for us *because we wrote the engine and know the invariants*, but they have three failure modes:
   - **Other users can't replicate them.** A user hitting the same engine bug doesn't know which `git reset` to run. Our shortcut hides the bug from triage instead of surfacing it.
   - **They double-state the workflow.** Manual git mutations leave the engine's tracking out of sync with the on-disk reality, producing the next class of stuck states (loops back to the same problem one tick later).
   - **They erode the contract.** The agent is supposed to drive the workflow only via MCP tools (`haiku_run_next`, `haiku_unit_*`, `haiku_feedback_*`, etc.). Reaching past those tools breaks the boundary the engine relies on for invariants like "stage branch is always ahead of intent main" and "state.json is the single source of truth for stage position."

## The exception (narrow)

The only acceptable shortcut: when the engine itself returned a structured error that explicitly tells the agent to take a manual step (e.g. `merge_failed` with the message "commit any engine-owned dirty files (state.json, units/*.md) and re-tick"). In that case the engine has classified the situation and handed it back; running the suggested commit is following the engine's explicit instructions, not bypassing them.

## What this looks like in practice

- Engine returns a confusing action → read the relevant handler in `packages/haiku/src/orchestrator/workflow/handlers/*.ts`, find the bug, fix it. Then `/mcp` reconnect (so the new code loads) and re-run.
- Branch / merge state looks wrong → look at the git-worktree helpers in `packages/haiku/src/git-worktree.ts`. The engine has its own merge classification (in-place vs temp worktree, conflict-paths vs dirty-tree) and should make the call. If it makes the wrong call, fix the classification.
- Workflow phase regressed unexpectedly → look at the per-phase handlers and find what's writing the wrong state. Don't paper over it with a hand-edited `state.json`.
- "I just need to merge these branches and it'll be fine" → no. The engine knows the merge order. If it can't, fix the engine.

## The principle in one sentence

The agent has the same surface area as the user. Both drive the workflow only through MCP tools. When the tools fail, the fix lands in the engine, not in `git`.
