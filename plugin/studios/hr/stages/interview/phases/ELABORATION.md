# Interview Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Interview scorecard uses a structured rubric with behavioral anchors for each competency dimension"
- "Each interviewer's assessment includes specific examples from the candidate's responses, not just ratings"
- "Debrief summary synthesizes all interviewer perspectives with a clear hire/no-hire recommendation and rationale"

Bad criteria examples:
- "Interviews are completed"
- "Candidates are evaluated"
- "Scorecard is filled out"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
