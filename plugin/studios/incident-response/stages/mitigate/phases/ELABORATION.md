# Mitigate Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Mitigation action is documented with exact commands or config changes applied"
- "Verification confirms user-facing impact has stopped, measured by the same metrics that triggered the incident"
- "Rollback plan exists in case the mitigation itself causes regression"

Bad criteria examples:
- "Issue is mitigated"
- "Fix is applied"
- "Things are back to normal"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
