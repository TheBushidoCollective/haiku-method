# Sourcing Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Candidate pipeline includes at least 20 qualified prospects from 3+ distinct sourcing channels"
- "Each candidate profile documents source, relevant experience match, and initial fit assessment"
- "Outreach messages are personalized to each candidate's background and the specific role value proposition"

Bad criteria examples:
- "Candidates are found"
- "Pipeline is full"
- "Outreach is done"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
