# Expansion Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Opportunity brief identifies at least 2 expansion opportunities with quantified revenue impact and customer value justification"
- "Each opportunity maps to a specific customer pain point or strategic initiative with supporting evidence from usage data"
- "Expansion proposal includes a phased rollout plan with success metrics tied to customer business outcomes"

Bad criteria examples:
- "Upsell opportunities identified"
- "Growth plan exists"
- "Customer could buy more"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
