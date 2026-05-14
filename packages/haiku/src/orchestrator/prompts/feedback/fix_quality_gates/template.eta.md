## Quality Gates Failed

<%= message %>

### Instructions

Decide which failure shape this is, then act:

**Shape 1 — code issue:** the gate command is correct, the production code under `outputs:` is wrong. Edit the source files, commit, then call `haiku_run_next { intent: "<%= slug %>" }`. The engine re-runs the gates.

**Shape 2 — gate definition issue:** the gate's `command` is broken (typo, library API change, YAML serialization mangling, command targets a path that no longer exists, etc.). Fix the gate definition itself with `haiku_unit_set { intent: "<%= slug %>"<%= stageHint %>, unit: "<unit>", field: "quality_gates", value: [{name: "...", command: "...", dir?: "..."}, ...] }`. `quality_gates` is lifecycle-mutable on completed units precisely so this path stays open. Then call `haiku_run_next`.

Do NOT edit the unit's .md file directly — the workflow-fields hook blocks generic Read/Write/Edit on units, and the engine wouldn't recognize the change anyway. Use `haiku_unit_set`.
