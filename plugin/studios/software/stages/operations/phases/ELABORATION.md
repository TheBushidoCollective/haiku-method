# Operations Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Deployment pipeline runs `terraform plan` in CI and requires approval before `apply`"
- "Runbook covers: service restart, database failover, cache flush, and certificate rotation with step-by-step commands"
- "Alerts fire when error rate exceeds 1% over 5 minutes, with PagerDuty routing"
- "Health check endpoint responds within 5 seconds and verifies database connectivity"

Bad criteria examples:
- "Deployment is automated"
- "Runbook exists"
- "Monitoring is set up"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
