# Charter Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Project charter defines scope boundaries with explicit in-scope and out-of-scope items and rationale for each exclusion"
- "Success criteria are quantified with measurement methods, data sources, and target thresholds"
- "Stakeholder map identifies each stakeholder's interest, influence level, and required engagement approach"

Bad criteria examples:
- "Charter is written"
- "Scope is defined"
- "Stakeholders are identified"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
