# Analyze Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Quality report includes defect density, severity distribution, and trend analysis compared to previous releases"
- "Root cause analysis groups defects into categories (design, code, environment, data) with distribution percentages"
- "Risk assessment maps unresolved defects to business impact with recommendation for release, defer, or block"

Bad criteria examples:
- "Results are analyzed"
- "Metrics are computed"
- "Quality is assessed"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
