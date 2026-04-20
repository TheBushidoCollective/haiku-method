# Triage Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Incident brief includes severity level (SEV1-4) with justification based on user impact"
- "Blast radius assessment identifies all affected services, regions, and customer segments"
- "Communication plan specifies who has been notified and through which channels"

Bad criteria examples:
- "Severity is assessed"
- "People are notified"
- "Incident is triaged"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
