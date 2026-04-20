# Evaluate Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Effectiveness report measures outcomes at all 4 Kirkpatrick levels: reaction, learning, behavior, and results"
- "Pre/post assessment comparison quantifies knowledge gain with statistical significance for each learning objective"
- "Improvement recommendations are prioritized by impact and effort with specific curriculum revision suggestions"

Bad criteria examples:
- "Training is evaluated"
- "Feedback is collected"
- "Effectiveness is measured"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
