# Develop Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Each training module includes facilitator guide, participant materials, exercises, and assessment instruments"
- "Content is reviewed by a subject matter expert for accuracy and by a sample learner for clarity"
- "Materials are accessible — screen reader compatible, captioned videos, and sufficient color contrast"

Bad criteria examples:
- "Content is created"
- "Materials are ready"
- "Training is developed"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
