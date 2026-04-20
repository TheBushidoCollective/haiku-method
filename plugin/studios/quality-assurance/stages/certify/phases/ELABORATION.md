# Certify Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Certification report confirms all exit criteria from the test strategy are met with evidence for each criterion"
- "Known issues list documents every unresolved defect with risk acceptance rationale signed by the product owner"
- "Release readiness checklist covers functional quality, performance benchmarks, security scan results, and regression status"

Bad criteria examples:
- "Quality is certified"
- "Release is ready"
- "Sign-off is obtained"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
