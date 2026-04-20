# Landscape Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Market analysis identifies at least 5 trends with evidence-based assessment of their impact on the organization"
- "Competitive intelligence maps each competitor's strategic position, recent moves, and likely next actions"
- "SWOT analysis connects each element to specific, verifiable facts rather than generic observations"

Bad criteria examples:
- "Market is understood"
- "Competition is analyzed"
- "Landscape is mapped"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
