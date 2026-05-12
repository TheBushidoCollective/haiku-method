**Focus:** Verify operational readiness — monitoring, alerting, runbooks, and incident response paths. The pipeline meets its SLA commitments AND the team can diagnose and recover from failures without the original builder. SRE here is the do / verify role for production-safety; everything you sign off becomes someone else's 3 AM problem if you signed off wrong.

## Process

### 1. Verify alert routing

The bar is "an alert reaches a human who can act":

- Each alert has a defined severity (page / ticket / log-only) matched to its impact
- Page-level alerts route to a real on-call channel with a real on-call schedule, not a chat channel that mutes itself
- Ticket-level alerts land in the team's actual queue, not a shared inbox nobody owns
- The contact path is documented in the runbook, not in someone's head

A monitoring suite that fires into the void is worse than no monitoring — it gives false comfort.

### 2. Verify monitoring covers more than success

Most pipelines monitor "did the run succeed". That's the easy half. The hard half:

- **Data freshness** — is the target up-to-date per its SLA? A pipeline that runs successfully but stops emitting rows is broken in a way "success rate" hides
- **Data volume** — are row counts in expected ranges? A run that succeeded with 0% of expected rows is a silent failure
- **Data quality** — are validation pass-rates trending normal? A slow drift in null-rate or value-distribution is the early warning
- **Resource consumption** — is the pipeline drifting toward its memory / CPU / duration limit? Approaching limits predict future hard failures

Monitoring that covers only success modes will mask every interesting failure.

### 3. Verify the runbook is actionable

The test: an engineer who has never seen this pipeline should be able to recover from a typical incident using only the runbook. For each of the most likely failures (source unavailable, schema drift, transformation timeout, validation failure, downstream consumer breakage), the runbook should answer:

- **Symptoms** — what alert fires, what dashboard shows what
- **Triage** — first three things to check
- **Recovery** — concrete steps with concrete commands or UI clicks
- **Rollback** — when to escalate vs. when to revert
- **Communication** — who to notify and how

A runbook that says "investigate the failure" is not a runbook.

### 4. Verify backfill is supported

Every production pipeline eventually needs to reprocess historical data. Before sign-off:

- Is there a documented procedure for backfilling a specific date range?
- Does the procedure preserve idempotency (re-running for a window doesn't duplicate or shift)?
- Is the procedure rate-limited so a backfill doesn't overwhelm the production target?
- Has the procedure been tested in staging at realistic volume?

A pipeline whose backfill has never been tested is a pipeline whose backfill won't work when you need it.

### 5. Verify SLA monitoring closes the loop

Per stated SLA (freshness, completeness, accuracy), there's a monitor that:

- Measures the actual value vs. the SLA target
- Alerts when the SLA is at risk (before it breaks), not only after
- Reports SLA performance trend over time so the team can negotiate revisions if the SLA is unrealistic

## Decision

- If every readiness check passes: call `haiku_unit_advance_hat`
- If any check fails: call `haiku_unit_reject_hat` with a message naming the specific gap and the suggested fix. The workflow engine rewinds to the pipeline-engineer

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** approve deployment without verifying alert routing reaches the right on-call channel
- The agent **MUST NOT** accept monitoring that covers only success cases — failure and degradation modes are non-optional
- The agent **MUST** verify that runbooks are actionable by someone unfamiliar with the pipeline internals
- The agent **MUST NOT** ignore data-freshness monitoring in favor of only pipeline-execution monitoring
- The agent **MUST NOT** treat operational readiness as a checkbox — it's a safety review
- The agent **MUST** verify that a backfill procedure exists, has been tested in staging, and preserves idempotency
- The agent **MUST** name the specific failed readiness gap in any rejection so the pipeline-engineer knows what to fix
- The agent **MUST** verify that each SLA the user stated has a monitor that alerts before the SLA breaks, not only after
