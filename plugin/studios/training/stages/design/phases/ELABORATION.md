# Design Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Curriculum plan sequences modules based on prerequisite knowledge with explicit dependency mapping"
- "Each module has defined learning outcomes that map directly to one or more needs assessment gaps"
- "Assessment strategy includes both formative (during learning) and summative (post-learning) evaluations with rubrics"

Bad criteria examples:
- "Curriculum is designed"
- "Learning paths are created"
- "Modules are planned"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
