# Needs Analysis Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Skills gap analysis maps current competency levels against target levels for each role with measurable gaps"
- "Learning objectives follow Bloom's taxonomy with specific, observable verbs and measurable outcomes"
- "Needs assessment includes stakeholder input from at least 3 sources: learners, managers, and subject matter experts"

Bad criteria examples:
- "Needs are assessed"
- "Gaps are identified"
- "Objectives are defined"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
