# Negotiate Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Negotiation terms document captures agreed pricing with comparison to initial quote and market benchmarks"
- "Contract review identifies all risk clauses with recommended modifications and fallback positions"
- "SLA terms are specific with measurable thresholds, measurement methods, and remedies for non-compliance"

Bad criteria examples:
- "Terms are negotiated"
- "Contract is reviewed"
- "Price is agreed"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
