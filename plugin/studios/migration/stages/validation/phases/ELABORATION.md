# Validation Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Row-count reconciliation shows zero discrepancy between source and target for every entity"
- "Spot-check validation compares at least 100 randomly sampled records per entity with field-level diff"
- "Performance benchmarks show target query latency within 10% of source for critical paths"

Bad criteria examples:
- "Data looks correct"
- "Validation is complete"
- "Performance is acceptable"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
