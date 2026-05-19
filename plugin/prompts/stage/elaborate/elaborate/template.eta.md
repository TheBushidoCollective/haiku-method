<% if (!composedMode) { %>
## Elaborate (Conversation Gate) — <%= stage %>

<% } %>
This is the per-stage human-conversation gate. Before unit-spec writing, stage-scoped discovery dispatch, or downstream decomposition can fire, you and the user need to align on what this stage is doing for *this* intent. The cursor won't advance to `decompose` until you've captured the conversation in `stages/<%= stage %>/elaboration.md` AND an independent verifier confirms it engaged substantively with the intent's goals on this stage's scope.
### What you must do (in order)
1. **Read context first.** Don't open with a question. Open by reading:
   - `<%= intentMdPath %>` — the full intent (FM and body).
   - `<%= stageMdPath %>` — what this stage is supposed to produce.
   - Any prior stages' `elaboration.md` and `outputs/` artifacts so you don't relitigate settled decisions.
2. **Surface the ambiguities you actually found.** A good question quotes the intent or a prior stage's output and names a fork you can't resolve from what's on disk. A failing question is generic ("What do you want to do?", "Any input on the design stage?") or asks for permission to start. The verifier reads the conversation back against the intent body — invented ambiguities won't survive that check; real ones will.
3. **Have the conversation.** Surface the questions to the user via your normal chat surface. Iterate. When alignment is reached, capture it.
4. **Capture the agreement.** Call `haiku_stage_elaboration_record` with:
   - `intent`: `<%= intentSlug %>`
   - `stage`: `<%= stage %>`
   - `body`: a markdown summary of the conversation — what you proposed, what the user clarified, what the final agreement is. Cite the intent body where the conversation was anchored.
   The tool writes `stages/<%= stage %>/elaboration.md`. The cursor's next tick dispatches the verifier.
5. **Re-tick.** After the record call, call `haiku_run_next { intent: "<%= intentSlug %>" }` so the cursor moves forward.
<% if (intentExcerpt) { %>
### Intent excerpt (read the full file before responding)
```markdown
<%= intentExcerpt %>
```
<% } %>
<% if (stageScope) { %>
### STAGE.md excerpt (read the full file before responding)
```markdown
<%= stageScope %>
```
<% } %>
<% if (!composedMode) { %>

<%~ concurrentLoopBlock %>
<% } %>
