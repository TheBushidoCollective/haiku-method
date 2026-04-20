# Budget Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Budget allocations sum to within 2% of the approved total envelope with variance explanations for each department"
- "Each line item maps to a specific forecast assumption and can be traced to a revenue or cost driver"
- "Contingency reserves are sized based on historical variance patterns, not arbitrary percentages"

Bad criteria examples:
- "Budget is allocated"
- "Numbers add up"
- "Targets are set"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
