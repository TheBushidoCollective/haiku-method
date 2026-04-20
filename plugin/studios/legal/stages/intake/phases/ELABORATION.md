# Intake Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Legal brief identifies all parties, jurisdictions, and governing law with specific statute references"
- "Risk assessment categorizes each identified risk by likelihood and impact with mitigation strategies"
- "Requirements document maps business objectives to specific legal instruments needed"

Bad criteria examples:
- "Requirements are gathered"
- "Risk is assessed"
- "Brief is written"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
