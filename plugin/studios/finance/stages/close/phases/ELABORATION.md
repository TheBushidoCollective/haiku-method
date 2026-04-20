# Close Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "All balance sheet accounts are reconciled with supporting schedules and no unexplained differences over $100"
- "Revenue recognition entries are documented with contract references and ASC 606 compliance notes"
- "Close checklist confirms all sub-ledgers are posted, intercompany eliminations are complete, and trial balance ties"

Bad criteria examples:
- "Books are closed"
- "Reconciliation is done"
- "Period is finalized"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
