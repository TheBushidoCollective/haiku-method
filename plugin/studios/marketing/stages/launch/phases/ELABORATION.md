# Launch Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Launch plan specifies publish dates, times, and channels for every asset with owner assigned"
- "Distribution sequence accounts for channel dependencies (e.g., landing page live before ad activation)"
- "Campaign log records actual publish timestamps and initial delivery metrics for each channel"

Bad criteria examples:
- "Campaign is launched"
- "Assets are distributed"
- "Schedule is set"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
