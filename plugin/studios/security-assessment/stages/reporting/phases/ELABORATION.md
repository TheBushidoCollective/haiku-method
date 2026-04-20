# Reporting Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Each finding includes severity rating (CVSS), affected asset, reproduction steps, evidence artifacts, and specific remediation guidance"
- "Executive summary communicates overall risk posture in business terms understandable by non-technical stakeholders"
- "Remediation plan prioritizes fixes by risk-reduction impact and includes both quick wins and strategic improvements"

Bad criteria examples:
- "Report is written"
- "Findings are documented"
- "Remediation is suggested"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
