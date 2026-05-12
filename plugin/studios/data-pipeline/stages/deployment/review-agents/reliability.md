---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the deployed pipeline is resilient under realistic failure modes and observable in production by someone who didn't build it.

## Check

The agent **MUST** verify, and file feedback for any violation:

- **Failure-recovery definition** — Retry policy per stage (max attempts, backoff strategy, what counts as retryable), dead-letter destinations for unrecoverable records, and alert wiring on hard failures are all explicit, not implicit
- **Resource sizing for peak** — Memory, CPU, and parallelism are sized for the projected peak volume from the discovery brief's growth curve, not for current average load. Concurrency limits prevent overlapping runs of the same pipeline
- **Monitoring breadth** — Coverage includes pipeline-execution health (success rate, duration, retry counts), data health (rows landed per stage, freshness per target, validation pass rate), and resource trends (drift toward memory / CPU / duration limits)
- **Alert actionability** — Every alert has a severity (page / ticket / log-only) matched to impact, a route to a real on-call channel with a real schedule, and a runbook entry. Alerts that fire into the void provide false comfort
- **Backfill readiness** — A documented backfill procedure exists, has been tested in staging at realistic volume, preserves idempotency, and is rate-limited so a backfill doesn't overwhelm the production target
- **Runbook actionability** — For each of the most likely failure modes (source unavailable, schema drift, transformation timeout, validation failure, downstream-consumer breakage), the runbook covers symptoms, triage, recovery, rollback, and communication — concrete enough that an unfamiliar engineer can act on it
- **First-run plan and rollback** — Before initial production deployment, "good first run" criteria are explicit (specific row counts, validation results, latency), rollback triggers are explicit, and rollback steps are concrete

## Common failure modes to look for

- A pipeline with retry policies but no defined dead-letter destination
- Resource limits set to "default" with no reference to actual peak volume
- Monitoring of "pipeline succeeded" without monitoring of "target stayed fresh" — a pipeline that emits zero rows successfully looks healthy
- Alerts routed to a chat channel nobody owns or that's muted
- A backfill procedure documented but never exercised in staging
- A runbook entry that says "investigate the failure" with no triage steps
- A first-run plan that says "ship it and see" with no specific success criteria and no rollback trigger
- An on-call schedule that has gaps (nights, weekends) without escalation paths defined
