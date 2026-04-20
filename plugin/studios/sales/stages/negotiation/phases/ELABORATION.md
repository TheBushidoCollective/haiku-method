# Negotiation Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Objection handling document addresses each raised concern with evidence-based responses and fallback positions"
- "Contract redlines are categorized by risk level with recommended accept/reject/counter for each"
- "Stakeholder alignment matrix shows each decision-maker's current position and required actions to move them forward"

Bad criteria examples:
- "Objections are handled"
- "Terms are negotiated"
- "Stakeholders are aligned"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
