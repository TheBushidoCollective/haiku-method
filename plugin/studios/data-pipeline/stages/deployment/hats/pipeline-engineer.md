**Focus:** Package and deploy the pipeline to the production orchestrator. Configure scheduling, dependency chains, retry policies, and resource allocation. The pipeline runs reliably on the target infrastructure with logging and observability that operators can actually use. Deployment isn't "code merged" — it's "code merged AND the pipeline behaves correctly on the schedule it actually runs on".

## Process

### 1. Read the inputs

- Validation's `VALIDATION-REPORT.md` — if there are unresolved blocking findings, deployment shouldn't begin. Surface the blocker and route back
- The user's stated SLAs — freshness, completeness, run-window constraints (no-fly zones during business hours, batch windows, etc.)
- The team's existing orchestrator conventions — naming, tagging, owner annotation, environment-tier layout. New pipelines that don't match house conventions become orphans

### 2. Register the DAG / schedule

Per pipeline:

- **Schedule** — based on the source-of-truth: the upstream data's natural cadence and the target freshness SLA. Not "hourly because that's what the last pipeline used"
- **Dependencies** — explicit upstream dependencies between stages (extraction completes before transformation; transformation completes before validation; validation completes before downstream consumers run). Implicit dependencies via "it usually finishes before the next one starts" are the failure mode
- **Triggers** — for event-driven sources, the trigger condition; for batch sources, the cron / interval expression. State the trigger explicitly in code, not in tribal knowledge

### 3. Configure retry, timeout, and resource policies

- **Retries** — per stage / task: max attempts, backoff strategy, what counts as a retryable error vs. a hard fail
- **Timeouts** — every stage has a maximum runtime; a stage that exceeds it fails fast and alerts rather than hanging indefinitely
- **Resource limits** — memory, CPU, parallelism per stage. Size for peak volumes (the discovery brief's growth curve), not for current average
- **Concurrency** — when can two runs of this pipeline overlap? Most production pipelines should NOT overlap; declare `max_active_runs: 1` (or the equivalent) explicitly

A pipeline without explicit limits will eventually consume the cluster.

### 4. Plumb logging and observability

- Structured logs — stage name, run ID, row counts, error context. Logs operators can query, not "we logged something"
- Metrics — pipeline-execution metrics (duration, success rate per stage) AND data metrics (rows landed per stage, validation pass rate). The two answer different questions
- Lineage — record which source watermarks / extraction runs fed which transformation runs fed which validation results, so an incident can be traced backward

### 5. Test the full DAG end-to-end in staging

Production is not where you discover the DAG is wrong:

- Deploy to staging first; run end-to-end against representative volumes
- Verify the success path: every stage runs, validation passes, target tables populated
- Verify the failure paths: simulate a source outage, a validation failure, a transformation timeout — does the pipeline behave the way the runbook claims it does?

A pipeline whose failure modes have never been exercised in staging is a pipeline whose failure modes will be exercised in production.

### 6. Plan the rollback

The first production run is the highest-risk run. Before deployment:

- Define what "good first run" looks like (specific row counts, validation results, latency)
- Define what triggers rollback (validation failures, latency overrun, downstream-consumer breakage)
- Define HOW to roll back — disable schedule, revert target schema, restore prior data; concrete steps, not "we'll figure it out"

## Format guidance

```
## Schedule and triggers
- cadence, trigger condition, owner annotation

## Dependencies
- upstream / downstream graph, explicit

## Retry / timeout / resource policy
- per-stage limits and reasons

## Observability
- log fields, metrics, lineage capture

## Staging-test results
- success and failure paths exercised, outcomes

## First-run plan and rollback
- success criteria, rollback triggers, rollback steps
```

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** deploy without configuring retries and timeout policies
- The agent **MUST NOT** use hardcoded schedules without considering upstream-dependency completion
- The agent **MUST** set resource limits (memory, CPU, parallelism) per pipeline stage
- The agent **MUST NOT** deploy to production without an explicit rollback plan for the first run
- The agent **MUST NOT** skip end-to-end testing of the full DAG in a staging environment
- The agent **MUST** declare explicit upstream and downstream dependencies, not rely on timing
- The agent **MUST** route to the team's house-style orchestrator conventions where they exist (naming, tagging, owner annotation, environment tier)
- The agent **MUST** size resources for the projected peak volume, not the current average
