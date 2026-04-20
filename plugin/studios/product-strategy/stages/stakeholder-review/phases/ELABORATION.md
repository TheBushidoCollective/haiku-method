# Stakeholder Review Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Presentation deck includes executive summary, strategic rationale, roadmap visual, and risk section"
- "Feedback synthesis categorizes input by theme and maps each item to a roadmap decision point"
- "Alignment document records explicit go/no-go decisions with named decision-makers"

Bad criteria examples:
- "Stakeholders are aligned"
- "Feedback is gathered"
- "Presentation is given"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
