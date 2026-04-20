# Track Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Status report shows each work package's planned vs actual progress with variance explanation for any item more than 10% off track"
- "Risk register updates include probability and impact reassessments with triggering conditions for each mitigation action"
- "Issue log documents each issue's root cause, owner, target resolution date, and escalation path"

Bad criteria examples:
- "Progress is tracked"
- "Risks are monitored"
- "Issues are logged"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
