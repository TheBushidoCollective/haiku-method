# Draft Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Contract draft addresses every requirement from the legal brief with traceable clause references"
- "Defined terms are used consistently throughout with no ambiguous or undefined terms in operative provisions"
- "Each protective clause maps to a specific risk identified in the intake risk assessment"

Bad criteria examples:
- "Draft is written"
- "Contract looks good"
- "Terms are included"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
