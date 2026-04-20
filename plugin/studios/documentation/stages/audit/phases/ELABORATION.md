# Audit Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Inventory covers all public APIs with status (documented/outdated/missing) for each"
- "Gap analysis prioritizes documentation needs by user impact and frequency of support requests"
- "Each identified gap includes a severity rating and recommended documentation type"

Bad criteria examples:
- "Audit is complete"
- "Gaps are identified"
- "Documentation is reviewed"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
