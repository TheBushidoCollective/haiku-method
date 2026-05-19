### Parent Instructions (do NOT include in subagent prompt)

Spawn the subagent with the Task tool. Map the `<subagent>` block attributes to the tool parameters **exactly**:

- `type="..."` → `subagent_type` argument
- `model="..."` → `model` argument (OMIT the `model` arg when the attribute is absent — do NOT pass a default)
<% if (backgroundSpawn) { %>
- `background="true"` → `run_in_background: true` argument (always present on hat dispatches — pass it through; the parent has nothing to do until the subagent finishes, so foreground would block this thread for no reason)
<% } %>
- `prompt_file="..."` → the prompt body is the literal string `"Read <path> and execute its instructions exactly."` (substitute `<path>` with the attribute value)

After the assessor returns: call `haiku_run_next { intent: ... }`. If it approved, the workflow engine has marked the unit's claimed feedback items as `closed`. If it rejected, the unit has bolted back to the first hat and the feedback items remain `pending`.