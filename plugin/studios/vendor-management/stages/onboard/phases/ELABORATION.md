# Onboard Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Onboarding checklist confirms account setup, access provisioning, data migration, and integration testing are complete"
- "Integration validation includes end-to-end data flow testing with error handling verification"
- "Escalation paths are documented with named contacts, response time expectations, and severity definitions"

Bad criteria examples:
- "Vendor is onboarded"
- "Setup is complete"
- "Integration works"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
