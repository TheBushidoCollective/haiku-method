<% if (!composedMode) { %>
## Decompose Review (Coverage Verifier) — <%= stage %>

<% } %>
Units exist for stage `<%= stage %>` but the decompose-verifier has not stamped `decompose_verified_at` on `<%= elabPath %>`. Dispatch a verifier subagent to audit that the drafted units cover the captured conversation — no scope is missing, no unit drifts.
### Dispatch the verifier
Use the Task tool to spawn one subagent with the prompt below. Wait for it to return, then call `haiku_run_next { intent: "<%= intentSlug %>" }` to re-tick.
```
You are the decompose-verifier for intent <%= intentSlug %>, stage <%= stage %>.

Your single job: read the captured conversation, the intent, the stage definition, and every unit spec for this stage. Decide whether the units collectively cover what the conversation agreed on.

Files to read (in order):
1. <%= elabPath %> — the captured conversation artifact.
2. <%= intentMdPath %> — the intent (FM and body).
3. <%= stageMdPath %> — the stage's scope and outputs.
4. Every unit spec under <%= unitsDir %> — read each via the `haiku_unit_read` tool to ensure you see the canonical body.

Pass criteria (ALL must be true):
- Every concrete deliverable the conversation agreed to ship from *this* stage maps to at least one unit's `outputs:` or body.
- No unit's scope extends past what the conversation discussed (no silent expansion).
- Unit `depends_on` ordering reflects the sequence the conversation implied (where order matters).
- Unit quality gates (when declared) are realistic for the spec — not aspirational placeholders.

Fail signals:
- The conversation discusses three deliverables; the units cover two.
- A unit appears that has no anchor in the conversation (drift).
- Units overlap so significantly that scope is duplicated.
- A unit declares outputs the stage's STAGE.md does not list as stage-scoped.

On pass: call `haiku_stage_decompose_seal` with { intent: "<%= intentSlug %>", stage: "<%= stage %>", nonce: "<%= verifierNonce %>" }. The tool stamps `decompose_verified_at` on the elaboration artifact and the cursor advances past `decompose_review` on the next tick. The `nonce` argument is REQUIRED — the seal tool refuses without it (`verifier_nonce_invalid`).

On fail: do NOT call seal. File feedback via `haiku_feedback` ({ intent: "<%= intentSlug %>", stage: "<%= stage %>", origin: "adversarial-review", source_ref: "decompose-verifier", body: "<gap description>", target_unit: null, target_invalidates: ["decompose_complete"] }). The fix loop will rerun decomposition.
```
### When the verifier returns
- Pass → call `haiku_run_next`. Cursor advances past `decompose_review` into the wave loop.
- Fail → the verifier filed feedback. Call `haiku_run_next` so the cursor picks up the open FB via Track B (feedback loop). The fix-hat chain will reopen decomposition.
<% if (!composedMode) { %>

<%~ concurrentLoopBlock %>
<% } %>
