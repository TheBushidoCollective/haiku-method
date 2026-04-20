# Assess Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Gap analysis evaluates every in-scope control with current implementation status (met/partial/unmet) and supporting evidence"
- "Risk assessment assigns likelihood and impact scores to each gap using a consistent methodology"
- "Assessment documents the specific evidence reviewed for each control determination"

Bad criteria examples:
- "Gaps are identified"
- "Risks are assessed"
- "Assessment is thorough"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
