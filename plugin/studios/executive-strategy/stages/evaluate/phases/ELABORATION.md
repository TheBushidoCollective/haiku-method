# Evaluate Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Tradeoff analysis scores each option against weighted criteria with explicit reasoning for each score"
- "Scenario modeling tests each option under at least 3 market conditions (bull, base, bear) with quantified outcomes"
- "Risk analysis identifies the top 3 risks per option with probability estimates and mitigation strategies"

Bad criteria examples:
- "Options are evaluated"
- "Tradeoffs are analyzed"
- "Risks are identified"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
