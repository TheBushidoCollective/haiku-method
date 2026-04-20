# Remediate Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Each remediated control has a test or verification procedure confirming it now meets the requirement"
- "Policy documents follow the framework's required structure and cover all mandatory sections"
- "Configuration changes are committed with traceability back to the specific gap they address"

Bad criteria examples:
- "Gaps are fixed"
- "Policies are written"
- "Controls are implemented"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
