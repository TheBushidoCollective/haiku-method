# Discovery Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Source catalog documents at least all known data sources with connection type, schema, and estimated row counts"
- "SLA requirements are captured for each target table including freshness, completeness, and acceptable error rates"
- "Schema analysis identifies all nullable fields, data type mismatches, and encoding inconsistencies across sources"

Bad criteria examples:
- "Sources are documented"
- "Schemas are understood"
- "Requirements are gathered"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
