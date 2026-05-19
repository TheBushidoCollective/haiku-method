### Concurrent elaborate-loop activities (you may stack these into this tick)

The elaborate loop is **one conceptual cursor state** with five completion signals (conversation captured, conversation verified, discovery artifacts present, units drafted, decompose coverage verified). The cursor emits the *first* still-unmet signal per tick — your primary task above — but you are NOT restricted to that one activity. If any of the following preconditions are met right now, addressing them in the same response collapses ticks: the next `haiku_run_next` re-walks the signals and skips ahead.

You may make progress on any of these alongside the primary task:

<% for (const line of concurrentLines) { %>- <%~ line %>
<% } %>
Then call `haiku_run_next { intent: "<%= slug %>" }` once. The cursor re-evaluates which signal is still unmet and dispatches the next.

**Filing user-decision FBs.** If discovery (running or already returned) surfaced a fork the user must resolve, file `haiku_feedback { origin: "discovery", resolution: "question", … }` rather than guessing. Open `origin: discovery, resolution: question` FBs keep the elaborate loop's question-completion signal unmet, so the next tick routes Track B's `feedback_question` action and the cursor stays in this loop until the user answers.
