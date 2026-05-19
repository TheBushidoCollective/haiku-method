<% if (!composedMode) { %>
## Elaborate (Conversation Gate) — <%= stage %>

<% } %>
This is the per-stage human-conversation gate. Before any unit-spec writing, stage-scoped discovery dispatch, or downstream decomposition can fire, you and the user need to align on what this stage is actually doing for *this* intent. The cursor will not advance to `decompose` until you've captured the conversation in `stages/<%= stage %>/elaboration.md` AND a verifier has independently confirmed it engaged substantively with the intent's goals on this stage's scope.
### What you must do (in order)
1. **Read context first.** Don't open with a question. Open by reading:
   - `<%= intentMdPath %>` — the full intent (FM and body).
   - `<%= stageMdPath %>` — what this stage is supposed to produce.
   - Any prior stages' `elaboration.md` and `outputs/` artifacts so you don't relitigate settled decisions.
2. **Identify the real uncertainties.** Specific to *this* intent on *this* stage. Examples of good questions:
   - "The intent calls out mobile and desktop but the design stage's scope is ambiguous about which surfaces. Are both in scope here, or is mobile a follow-up?"
   - "Prior stage's elaboration captured a Stripe integration. This stage produces the checkout UX — should I assume Stripe Elements, or is the payment surface still open?"
   Examples of failures of this gate (the verifier will reject these):
   - "What do you want to do?"
   - "I'm starting the design stage — let me know if you have any input."
   - One question, generic, with no reference to the intent's actual content.
3. **Have the conversation.** Surface the questions to the user via your normal chat surface. Iterate. When you believe alignment is reached, capture the outcome.
4. **Capture the agreement.** Call `haiku_stage_elaboration_record` with:
   - `intent`: `<%= intentSlug %>`
   - `stage`: `<%= stage %>`
   - `body`: a markdown summary of the conversation — what you proposed, what the user clarified, what the final agreement is. Cite the intent body where the conversation was anchored.
   The tool writes `stages/<%= stage %>/elaboration.md`. The cursor's next tick will dispatch the verifier.
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
### What this gate REQUIRES
- A substantive conversation. The verifier will reject a one-question check-in — engage with this intent's actual content, surface specific ambiguities, and capture the agreement with citations back into the intent body.
- The conversation artifact recorded via `haiku_stage_elaboration_record` before the cursor will dispatch the verifier. A conversation that lives only in chat doesn't satisfy the gate; the verifier reads the on-disk artifact.
<% if (!composedMode) { %>

<%~ concurrentLoopBlock %>
<% } %>
