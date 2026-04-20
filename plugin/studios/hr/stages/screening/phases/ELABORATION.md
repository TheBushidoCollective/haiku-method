# Screening Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Each candidate is scored against must-have criteria with pass/fail justification documented"
- "Screening report ranks candidates by composite fit score with clear methodology"
- "Disqualification reasons are specific and traceable to job spec requirements, not subjective impressions"

Bad criteria examples:
- "Candidates are screened"
- "Top candidates are identified"
- "Resumes are reviewed"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
