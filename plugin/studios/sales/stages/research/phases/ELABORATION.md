# Research Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Prospect brief identifies the company's top 3 strategic priorities with supporting evidence"
- "Competitive landscape covers at least 3 incumbent vendors with strengths and weaknesses"
- "Pain point analysis maps each identified pain to a specific product capability"

Bad criteria examples:
- "Research is complete"
- "Prospect is understood"
- "Competitive analysis is done"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
