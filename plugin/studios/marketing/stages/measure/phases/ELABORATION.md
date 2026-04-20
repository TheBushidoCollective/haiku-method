# Measure Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Performance report compares actual KPIs against campaign goals with variance analysis"
- "Channel-level breakdown identifies top and bottom performers with specific metrics"
- "Recommendations are data-backed with projected impact if implemented"

Bad criteria examples:
- "Metrics are reported"
- "Performance is analyzed"
- "Recommendations are provided"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
