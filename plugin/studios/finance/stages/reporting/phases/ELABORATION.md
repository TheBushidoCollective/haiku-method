# Reporting Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Executive summary distills the top 3 financial headlines with supporting data and recommended actions"
- "Dashboard visualizations use consistent scales, labeled axes, and highlight thresholds or targets"
- "Each report section maps to a specific stakeholder audience with appropriate detail level"

Bad criteria examples:
- "Reports are generated"
- "Dashboard looks good"
- "Stakeholders are informed"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
