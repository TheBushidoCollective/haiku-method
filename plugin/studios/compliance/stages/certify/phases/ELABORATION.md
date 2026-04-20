# Certify Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Audit readiness checklist confirms all evidence is current, accessible, and mapped to the auditor's request list"
- "Each auditor finding has a documented response with remediation evidence or a justified exception"
- "Finding resolution includes root cause analysis to prevent recurrence, not just a fix for the immediate gap"

Bad criteria examples:
- "Audit is prepared for"
- "Findings are resolved"
- "Certification is obtained"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
