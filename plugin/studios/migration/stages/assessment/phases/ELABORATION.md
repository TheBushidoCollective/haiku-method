# Assessment Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Inventory covers all source tables/services with row counts and dependency mappings"
- "Risk register identifies at least 3 categories (data loss, downtime, compatibility) with severity ratings"
- "Dependency graph shows which systems must migrate in sequence vs. parallel"

Bad criteria examples:
- "Assessment is complete"
- "Risks are documented"
- "Systems are inventoried"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
