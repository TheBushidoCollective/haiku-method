# Discovery Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Market landscape covers at least 3 segments with size estimates and growth trends"
- "Competitive analysis identifies at least 5 direct competitors with positioning maps"
- "Opportunity space includes at least 3 underserved segments with evidence for each"

Bad criteria examples:
- "Market research is complete"
- "Competitors are listed"
- "Opportunities are identified"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
