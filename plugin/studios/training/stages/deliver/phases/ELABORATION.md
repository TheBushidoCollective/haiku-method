# Deliver Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Delivery log records attendance, completion rates, and real-time learner feedback for each session"
- "Facilitation notes capture questions asked, areas of confusion, and suggested content improvements"
- "Logistics checklist confirms all technical setup, access provisioning, and material distribution is complete before each session"

Bad criteria examples:
- "Training is delivered"
- "Sessions are complete"
- "Logistics are handled"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
