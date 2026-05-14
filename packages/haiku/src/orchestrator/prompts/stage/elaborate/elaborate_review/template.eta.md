<% if (isPreIntent) { %>
<% if (!composedMode) { %>
## Pre-Intent Elaborate Review (Substance Verifier)

<% } %>
The conversation that produced `intent.md` for <%= intentSlug %> hasn't been verified. Dispatch a verifier subagent to grade the intent for substance before any stage walk fires.
### Dispatch the verifier
Use the Task tool to spawn one subagent with the prompt below. Wait for it to return, then call `haiku_run_next { intent: "<%= intentSlug %>" }` to re-tick.
```
You are the pre-intent elaboration verifier for intent <%= intentSlug %>.

Your single job: read `<%= intentMdPath %>` and decide whether its body reflects a meaningful conversation between the user and the originating agent.

Pass criteria (ALL must be true):
- The body describes a specific goal, not a generic placeholder.
- The scope reflects real choices the user made (what's in, what's explicitly out).
- Constraints, integrations, audience, and surfaces are concrete enough that a stage's elaborate phase can anchor on them.
- The intent is differentiated from "build a generic X" — it has the texture of THIS user wanting THIS thing.

Fail signals:
- One-paragraph generic "build a SaaS app" body with no scoping.
- No mention of audience, constraints, or non-goals.
- Body looks like the agent guessed at requirements without conversation.

On pass: call `haiku_intent_seal` with { intent: "<%= intentSlug %>", nonce: "<%= verifierNonce %>" } (and optional `notes`). The tool stamps `verified_at` on intent FM. The `nonce` argument is REQUIRED — the seal tool refuses without it (`verifier_nonce_invalid`).

On fail: do NOT call seal. Return a structured response with the specific gaps the outer agent must address — quote the lines from intent.md that are thin, name what's missing. The outer agent re-engages the user and updates the intent body before the verifier re-tries.
```
### When the verifier returns
- Pass → call `haiku_run_next`. Cursor will advance into the first stage's elaborate gate.
- Fail → take the verifier's gap list back to the user. Update intent.md (re-record via the intent_create flow or via direct body update). Then call `haiku_run_next` for another verification pass.
<% } else { %>
<% if (!composedMode) { %>
## Elaborate Review (Substance Verifier) — <%= stage %>

<% } %>
The conversation artifact at `<%= elabPath %>` exists but is unverified. Dispatch a verifier subagent to grade it for substance before the cursor can advance to `decompose`.
### Dispatch the verifier
Use the Task tool to spawn one subagent with the prompt below. Wait for it to return, then call `haiku_run_next { intent: "<%= intentSlug %>" }` to re-tick.
```
You are the elaboration verifier for intent <%= intentSlug %>, stage <%= stage %>.

Your single job: read three files and decide whether the captured conversation engaged substantively with *this* intent's goals as they bear on *this* stage's scope.

Files to read (in order):
1. <%= elabPath %> — the captured conversation artifact.
2. <%= intentMdPath %> — the intent (FM and body).
3. <%= stageMdPath %> — the stage's scope and outputs.

Pass criteria (ALL must be true):
- The conversation references specific content from the intent body, not just the FM.
- The questions surfaced are tied to ambiguities in *this* intent on *this* stage's scope. Generic questions ("what do you want?") fail.
- The agreement captured at the end is concrete enough that downstream unit decomposition could anchor on it.
- The conversation surfaces at least one decision point or clarification, not just acknowledgment.

Fail signals:
- One-line "user said go" with no preceding exchange.
- Generic agent monologue with no user voice captured.
- Conversation about a different intent or stage.
- No reference to specific intent content (mobile, desktop, integrations, named features, etc.).

On pass: call `haiku_stage_elaboration_seal` with { intent: "<%= intentSlug %>", stage: "<%= stage %>", nonce: "<%= verifierNonce %>" }. The tool stamps `verified_at` on the artifact's frontmatter. The `nonce` argument is REQUIRED — the seal tool refuses without it (`verifier_nonce_invalid`).

On fail: do NOT call seal. Return a structured response with the specific gaps the outer agent must address — quote the lines from the artifact that are thin, name what's missing, and suggest what the next conversation turn should cover. The outer agent will overwrite the artifact and re-verify.
```
### When the verifier returns
- Pass → call `haiku_run_next`. Cursor will advance to `decompose`.
- Fail → take the verifier's gap list back to the user. Have the missing conversation. Call `haiku_stage_elaboration_record` again with the updated body — this overwrites the artifact and clears the (still-missing) `verified_at`. Then call `haiku_run_next` for another verification pass.
<% if (!composedMode) { %>

<%~ concurrentLoopBlock %>
<% } %>
<% } %>
