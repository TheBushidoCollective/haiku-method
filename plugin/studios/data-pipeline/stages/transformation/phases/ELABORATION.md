# Transformation Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Transformation SQL is idempotent — re-running produces the same result without duplicates"
- "Data model follows the agreed dimensional modeling pattern with surrogate keys and SCD type documented per dimension"
- "All business logic (e.g., revenue recognition rules, status mappings) is centralized in named CTEs or macros, not scattered across queries"

Bad criteria examples:
- "Transformations are complete"
- "Data model looks good"
- "Business logic is implemented"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
