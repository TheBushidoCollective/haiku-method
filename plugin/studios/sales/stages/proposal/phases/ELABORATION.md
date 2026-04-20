# Proposal Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Proposal maps each prospect pain point to a specific solution capability with expected impact"
- "Business case includes quantified ROI with stated assumptions and a sensitivity analysis"
- "Demo script addresses the top 3 prospect priorities identified in the deal brief"

Bad criteria examples:
- "Proposal is written"
- "Business case looks compelling"
- "Demo is ready"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
