### Parent Instructions (do NOT include in subagent prompt)

Spawn the subagent with the Task tool. Map the `<subagent>` block attributes to the tool parameters **exactly**:

- `type="..."` → `subagent_type` argument
- `model="..."` → `model` argument (OMIT the `model` arg when the attribute is absent — do NOT pass a default)
<% if (backgroundSpawn) { %>
- `background="true"` → `run_in_background: true` argument (always present on hat dispatches — pass it through; the parent has nothing to do until the subagent finishes, so foreground would block this thread for no reason)
<% } %>
- `prompt_file="..."` → the prompt body is the literal string `"Read <path> and execute its instructions exactly."` (substitute `<path>` with the attribute value)

Passing the `model` attribute is non-negotiable when it's present — the workflow engine resolved the tier from the unit/hat/stage/studio cascade and the wrong tier undermines the whole selection logic.

**When the subagent returns, its final message will be one of:**
- `Workflow Result: <path>` — read that JSON file and act on its `action` field. Valid actions: `continue_unit` (spawn next subagent for same unit), `start_units` (dispatch wave), `advance_phase`, `review`, `advance_stage`, `intent_complete`, `blocked`. For unit-level actions, call `haiku_run_next { intent: ... }` to get the workflow engine's canonical next step (the result file and run_next return the same data; run_next is the authoritative drive step).
- Plaintext "job ends here" message — another subagent in the wave will produce the structured result; do not dispatch yet.
- Anything else (subagent non-compliant) — fall back: call `haiku_run_next { intent: ... }`.

Do NOT stop until run_next returns `gate_review`, `advance_stage → intent_complete`, `intent_complete`, or `error`.