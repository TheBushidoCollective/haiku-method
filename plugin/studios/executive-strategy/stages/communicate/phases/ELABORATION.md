# Communicate Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Communication plan tailors messaging to each stakeholder group with specific channels, timing, and key messages"
- "Rollout plan sequences actions with dependencies, owners, and measurable milestones"
- "FAQ document anticipates the top 10 likely questions with pre-approved responses"

Bad criteria examples:
- "Communication is planned"
- "Stakeholders are informed"
- "Rollout is ready"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
