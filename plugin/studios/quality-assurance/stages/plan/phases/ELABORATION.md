# Plan Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Test strategy defines scope, approach, and resource requirements with explicit coverage targets for each quality dimension"
- "Risk-based prioritization ranks test areas by business impact and failure probability with justification"
- "Entry and exit criteria are defined for each test phase with measurable thresholds"

Bad criteria examples:
- "Strategy is defined"
- "Plan is ready"
- "Coverage is planned"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
