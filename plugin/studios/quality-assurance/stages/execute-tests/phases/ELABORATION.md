# Execute Tests Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Test results document pass/fail status for every test case with evidence (screenshots, logs, or output) for each failure"
- "Defect reports include reproduction steps, environment details, severity classification, and root cause hypothesis"
- "Coverage report confirms execution percentage against the planned test suite with justification for any unexecuted tests"

Bad criteria examples:
- "Tests are run"
- "Defects are logged"
- "Testing is complete"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
