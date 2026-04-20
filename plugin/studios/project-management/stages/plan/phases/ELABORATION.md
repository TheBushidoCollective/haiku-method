# Plan Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Work breakdown structure elaborates every in-scope deliverable to work packages of 40 hours or less"
- "Resource allocation maps each work package to a named owner with confirmed availability"
- "Critical path is identified with float calculations and contingency buffers at high-risk junctions"

Bad criteria examples:
- "Plan is done"
- "Resources are assigned"
- "Timeline is set"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
