# Design Tests Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Test suite spec includes test cases for every requirement with traceability matrix linking tests to requirements"
- "Each test case has explicit preconditions, steps, expected results, and pass/fail criteria"
- "Automation feasibility assessment identifies which tests to automate, which to run manually, and the rationale"

Bad criteria examples:
- "Test cases are designed"
- "Automation is planned"
- "Tests are ready"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
