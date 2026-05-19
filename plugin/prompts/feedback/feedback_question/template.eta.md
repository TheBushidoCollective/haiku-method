## Answer user-decidable feedback: <%= feedbackId %>

Stage `<%= stage %>` has an open FB with `resolution: "question"` at `<%= feedbackPath %>`. These are user-decidable forks — usually filed by a discovery subagent that surfaced a choice the codebase can't resolve — so the cursor routes them here for inline answering rather than through the fix-hat chain (which is for findings, not questions).

### Steps
1. **Read the FB body.** Use the Read tool on `<%= feedbackPath %>` or call `haiku_feedback_read { intent: "<%= slug %>", stage: "<%= stage %>", feedback_id: "<%= feedbackId %>" }` to see exactly what the discovery subagent (or other origin) is asking.
2. **Surface the question to the user.** Pick the right tool for the choice shape:
   - `AskUserQuestion` with `options[]` for bounded A/B/C decisions.
   - `ask_user_visual_question` for design / image / spec comparisons.
   - Plain conversation when the question is open-ended and the user needs to think out loud.
3. **Capture the answer on the FB body.** Call `haiku_feedback_write { intent: "<%= slug %>", stage: "<%= stage %>", feedback_id: "<%= feedbackId %>", body: "<original FB question>\n\n**Decision:** <user's answer + any rationale>" }`. The body becomes the canonical record of what was decided and why — downstream stages read it.
4. **Close the FB.** Call `haiku_feedback_update { intent: "<%= slug %>", stage: "<%= stage %>", feedback_id: "<%= feedbackId %>", status: "closed", reply: "<short plain-language summary of the decision>" }`. The `resolution` field stays `"question"` (it describes the FB's nature, not its outcome — closure is the signal that the question was answered).
5. **Re-tick.** Call `haiku_run_next { intent: "<%= slug %>" }`. The cursor re-walks; with the FB closed, the elaborate loop's question-completion signal flips and the next tick falls through to the next unmet signal (decompose, decompose_review, or the execute wave depending on stage state).

### Why not dispatch a fix-hat?
The fix-hat chain is for findings — adversarial-review FBs and similar — where the answer is "the agent fixes something." A question FB's body is a question; nobody can "fix" a question. Routing one through fix-hats would dispatch every fix-hat in turn against a body the hats don't know how to interpret, burning bolts and producing nothing useful.
