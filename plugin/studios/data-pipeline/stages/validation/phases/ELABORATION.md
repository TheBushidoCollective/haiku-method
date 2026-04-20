# Validation Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Data quality checks cover uniqueness, not-null constraints, referential integrity, and accepted value ranges for every target table"
- "Row count reconciliation between source and target is within the agreed tolerance (e.g., < 0.1% variance)"
- "Business rule tests verify at least 3 known edge cases per critical transformation (e.g., timezone handling, currency conversion, null propagation)"

Bad criteria examples:
- "Data quality is validated"
- "Tests pass"
- "Business rules are checked"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
