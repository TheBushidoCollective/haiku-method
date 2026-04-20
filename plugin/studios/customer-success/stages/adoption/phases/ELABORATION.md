# Adoption Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Usage report identifies at least 3 underutilized features with specific enablement recommendations per feature"
- "Adoption plan includes measurable targets for DAU/MAU ratio, feature breadth, and workflow completion rates"
- "Enablement materials map each feature to a concrete business outcome the customer cares about"

Bad criteria examples:
- "Adoption is increasing"
- "Customer is using the product"
- "Features were explained"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
