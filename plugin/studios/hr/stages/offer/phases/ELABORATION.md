# Offer Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Compensation analysis benchmarks the candidate against internal equity bands and external market data with documented rationale for positioning"
- "Offer letter includes all material terms: base, bonus, equity, start date, and any negotiated accommodations"
- "Contingency plan documents fallback candidates and timeline if the primary candidate declines"

Bad criteria examples:
- "Offer is sent"
- "Compensation is fair"
- "Candidate accepted"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
