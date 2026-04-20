# User Research Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Research covers at least 3 distinct user personas with documented pain points for each"
- "Each job-to-be-done includes frequency, current workaround, and satisfaction level"
- "Insights report synthesizes patterns across at least 5 data points per theme"

Bad criteria examples:
- "Users are understood"
- "Pain points are documented"
- "Research is thorough"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
