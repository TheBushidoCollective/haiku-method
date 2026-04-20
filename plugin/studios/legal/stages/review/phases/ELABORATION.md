# Review Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Review findings document categorizes each issue as critical (must fix), important (should fix), or advisory (consider)"
- "Compliance check maps each regulatory requirement to the specific draft provision that satisfies it, with gap analysis"
- "Risk opinion quantifies residual risk for each identified exposure with recommended acceptance or mitigation"

Bad criteria examples:
- "Review is complete"
- "Document is compliant"
- "Issues are noted"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
