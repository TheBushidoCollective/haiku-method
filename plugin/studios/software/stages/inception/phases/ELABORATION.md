# Inception Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Discovery document identifies all user-facing capabilities and their business value"
- "Problem statement is clear enough for a non-technical stakeholder to understand"
- "Each unit has 3-5 completion criteria, each verifiable by a specific command or test"
- "Unit DAG has no circular dependencies — verified by topological sort"

Bad criteria examples:
- "Domain is understood"
- "Units have criteria"
- "Elaboration is complete"
- "Database schema is defined" (too technical for inception — belongs in design/development)


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
