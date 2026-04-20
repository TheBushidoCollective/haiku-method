# Extraction Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Extraction logic handles incremental loads using watermark columns identified in discovery"
- "Connector includes retry logic with exponential backoff and dead-letter handling for failed records"
- "Schema drift detection raises alerts rather than silently dropping or truncating columns"

Bad criteria examples:
- "Extraction works"
- "Data is pulled from sources"
- "Connectors are configured"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
