# Forecast Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Forecast model documents all assumptions with supporting data sources and confidence levels"
- "Revenue projections cover at least 3 scenarios (base, optimistic, pessimistic) with distinct assumption sets"
- "Market condition analysis references at least 5 data points from the last 90 days"

Bad criteria examples:
- "Forecast is done"
- "Revenue looks reasonable"
- "Market conditions are understood"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
