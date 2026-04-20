# Close Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Close checklist confirms signature, PO, and payment terms are all captured with document references"
- "Handoff document includes prospect history, key contacts, agreed deliverables, and timeline commitments"
- "Win/loss analysis documents the 3 most critical factors in the deal outcome with evidence"

Bad criteria examples:
- "Deal is closed"
- "Handoff is done"
- "Learnings are captured"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
