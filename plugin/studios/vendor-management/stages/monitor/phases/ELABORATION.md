# Monitor Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Performance report tracks each SLA metric against contractual thresholds with trend analysis over at least 3 periods"
- "Relationship health assessment documents communication quality, issue resolution timeliness, and strategic alignment"
- "Improvement recommendations are specific, actionable, and reference contractual remedies where SLAs are not met"

Bad criteria examples:
- "Performance is tracked"
- "SLAs are monitored"
- "Relationship is managed"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
