# Document Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Evidence package includes at least one artifact per control demonstrating implementation with timestamps and provenance"
- "Audit trail links every control to its scope definition, assessment finding, remediation action, and verification evidence"
- "Documentation follows the framework's required format and is organized for efficient auditor navigation"

Bad criteria examples:
- "Evidence is collected"
- "Documentation is complete"
- "Audit trail exists"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
