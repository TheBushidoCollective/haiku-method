## Approach Selection (before decomposing units)

If this stage has a meaningful architectural choice in front of it (e.g. *which* data model, *which* auth strategy, *which* deployment topology), pause and articulate **2–3 approaches** before drafting units. Each approach gets:

- one-sentence description of what's built and how
- the tradeoff axis the choice turns on (speed/safety, cost/flexibility, reversibility, etc.)
- a recommendation with one-sentence justification

<% if (collaborative) { %>
**In collaborative mode:** Use `ask_user_visual_question` to let the user pick. Record the resolved choice via `haiku_decision_record` (source: `user`). Only after the user picks (or you've stated explicitly that no architectural choice exists at this stage) should you draft units.
<% } else { %>
**In autonomous mode:** Choose the approach independently and state your rationale in one sentence. Do NOT prompt the user — autonomous mode means the agent decides. If the choice has cross-cutting risk, surface it inline in the elaborate output so a reviewer can challenge it later.
<% } %>

**Skip this only when:** discovery has already narrowed to a single forced approach, OR the stage's work is mechanical (no architectural choice — e.g. a runbook against a fixed deployment pipeline). In that case, state the forced approach in one sentence in the elaborate output and proceed to unit decomposition.

**Do NOT** dump three full design docs as units and ask the reviewer to pick later. The choice is upstream of decomposition; commit to one approach, then decompose it.