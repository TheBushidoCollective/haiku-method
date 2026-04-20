# Requisition Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Job spec includes must-have vs nice-to-have qualifications with clear rationale for each requirement"
- "Compensation range is benchmarked against at least 3 market data sources with geographic adjustments"
- "Role requirements map to specific team gaps or business needs with supporting evidence"

Bad criteria examples:
- "Job description is written"
- "Requirements are defined"
- "Role is approved"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
