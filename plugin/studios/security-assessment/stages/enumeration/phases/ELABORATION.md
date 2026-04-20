# Enumeration Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Vulnerability catalog lists each finding with CVE reference, CVSS score, affected service, and verification status"
- "Service enumeration identifies software versions for at least 90% of discovered services"
- "Attack surface map categorizes entry points by protocol, authentication requirement, and exposure level"

Bad criteria examples:
- "Services are enumerated"
- "Vulnerabilities are found"
- "Attack surface is documented"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
