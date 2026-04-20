# Scope Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Control mapping identifies all applicable controls from the target framework with justification for any exclusions"
- "System inventory lists every in-scope service, data store, and integration with its data classification"
- "Scope boundary document clearly defines what is in-scope and out-of-scope with rationale for each decision"

Bad criteria examples:
- "Scope is defined"
- "Controls are mapped"
- "Systems are inventoried"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
