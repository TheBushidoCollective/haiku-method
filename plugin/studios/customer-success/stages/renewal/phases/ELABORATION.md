# Renewal Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Renewal strategy includes a value summary with quantified ROI achieved during the contract period, sourced from actual usage and outcome data"
- "Negotiation brief anticipates at least 3 potential customer objections with prepared responses and concession boundaries"
- "Executive business review deck tells a clear value story: where they started, what they achieved, and where they can go next"

Bad criteria examples:
- "Renewal is prepared"
- "Contract terms discussed"
- "Customer will renew"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
