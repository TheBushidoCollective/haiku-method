# Security Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "OWASP Top 10 coverage verified: each category has at least one test or documented N/A justification"
- "All SQL queries use parameterized statements — verified by grep for string concatenation in query construction"
- "Authentication tokens expire after 1 hour and refresh tokens after 30 days, verified by test"
- "All user input is validated at the API boundary before reaching business logic"

Bad criteria examples:
- "Security review done"
- "No SQL injection"
- "Auth is secure"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
