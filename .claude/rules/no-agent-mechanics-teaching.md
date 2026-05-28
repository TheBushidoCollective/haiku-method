# No Agent Mechanics Teaching

Prompts must not teach the agent how the workflow engine works. The engine knows. The agent follows the breadcrumb the engine leaves in each tool return.

## The rule

Agent-facing prompts (parent dispatches, subagent prompts, template bodies in `plugin/prompts/`) must NOT contain prose like:

- "Slot pool of N. When one completes, fire a replacement..."
- "Wait for all N subagents to return before calling `haiku_run_next`..."
- "Spawn batch 1, wait, then spawn batch 2..."
- "After M items, call X. After N items, call Y..."
- "If the pool has space, dispatch the next..."
- "Multiple simultaneous completions: fire one replacement each..."
- "Process items in declared order so re-entries are deterministic..."
- "Poll every Ns until the dev server is up..."

Any sentence that conditions on slot count, queue depth, batch boundary, or replay/replenishment timing is the engine's job, not the agent's.

## Why

The agent doesn't have reliable state. Every turn it's reconstructing the world from prompt + tool returns. Anything we teach it about pool semantics, batch discipline, or "what comes after this" becomes a model that drifts the moment reality diverges from our prose:

- The agent batches all N completions before re-ticking → throughput collapses to the slowest item.
- The agent thinks the pool is exhausted when actually a chain is mid-relay → premature `run_next`.
- The agent over-reads its own prior turns and replays old mechanics → spawns dropped, slots stalled.

The cursor already walks the queue on every tick. The advance/reject tool returns already know whether there's a next item. The engine has reliable state on disk. Push the decision into the engine.

## The pattern (use this everywhere)

**Engine side.** Every tool that records workflow progress emits a `next_subagent_dispatch_block` field in its return (or null when there's nothing more). The block is the literal `<subagent prompt_file="...">` markup the parent will spawn — built inline using the same code path the cursor's dispatch prompt builder uses, so the two can never disagree.

**Subagent prompt.** The subagent's template tells it:

> When your tool returns, copy `next_subagent_dispatch_block` verbatim as your final message after your one-line work summary. Don't paraphrase. Don't decide whether to spawn it — that's your parent's call. If the field is empty/null, your final message is just the work summary and a one-line "call `haiku_run_next`" or whatever the tool said.

**Parent prompt.** The parent's template just says:

> Spawn each `<subagent>` block below in parallel. When a subagent returns, do what its final message tells you — spawn a relayed block, call `haiku_run_next`, or just acknowledge.

No counts. No batch boundaries. No "after all". The parent reacts to whatever it gets; the engine threads the chain.

## What this looks like for slot replenishment

When a chain's terminal advance fires:
- The advance_hat handler walks the queue (same cursor logic the dispatch prompt builder uses).
- If there's an unstarted FB / unit waiting, it builds that item's first-hat dispatch block and returns it as `next_subagent_dispatch_block`.
- The subagent relays it. The parent spawns it. A slot freed; a new chain started. No prose about pools needed.

If the queue is empty:
- `next_subagent_dispatch_block` is null/empty.
- The message says "call `haiku_run_next`" (or "wave done; intent sealed", etc.).
- The agent does exactly that.

## When the engine genuinely can't decide

A few flows still require the agent to make a judgment call — a `haiku_feedback_reject` because the finding is invalid, a user-decision question, etc. Those prompts can teach **decision criteria** (what makes a finding invalid, how to write the reject reason). They cannot teach **mechanics** (when to call run_next, how many to spawn at once, etc.).

Decision criteria are the agent's job. Mechanics are the engine's.

## Checklist before adding prose to a prompt

- [ ] Does this sentence tell the agent WHAT to do, or HOW the engine sequences work? If the latter, delete it.
- [ ] Does this sentence depend on a count, a batch size, a pool slot, a replay timing? If yes, move the decision into the engine and emit a breadcrumb instead.
- [ ] Is there a tool return that could carry this signal? If yes, plumb it through that, not the prompt body.
- [ ] If you removed the sentence, would the agent still know what to do this turn? If yes, you didn't need it. If no, the tool return is missing context — fix the return, not the prompt.

## Related rules

- [no-engine-shortcuts.md](no-engine-shortcuts.md) — agents drive workflow via MCP tools, not manual git. Same principle, opposite direction: don't bypass the engine, but also don't ask the agent to do its job.
