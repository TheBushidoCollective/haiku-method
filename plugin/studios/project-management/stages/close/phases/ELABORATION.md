# Close Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Retrospective identifies the top 3 things that went well and top 3 things to improve, each with specific examples"
- "Lessons learned are categorized as process, technical, or organizational with actionable recommendations"
- "Handoff checklist confirms all deliverables are transferred, documentation is complete, and support contacts are identified"

Bad criteria examples:
- "Project is closed"
- "Lessons are captured"
- "Handoff is done"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
