---
title: pii-deny-list-strip alert depends on metric that no exporter produces
status: rejected
origin: adversarial-review
author: observability
author_type: agent
created_at: '2026-05-02T05:31:56Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-02T05:31:56Z'
resolution: null
replies: []
---

**Mandate violation:** "alerts have clear runbooks or at minimum actionable descriptions" — the `pii-deny-list-strip` alert (`deploy/operations/drift-detection-alerts.yaml:60-72`) page-severity alert fires on `pii.deny.strip` rate. That metric has no emitter.

**Evidence:**
- Alert expression at line 68: `sum(rate(pii.deny.strip[1h])) > 0`
- The runtime PII gate at `packages/haiku/src/telemetry.ts:359-366` only writes a `console.error` to stderr — it does NOT call `emitTelemetry`. There is no OTLP event named `pii.deny.strip` anywhere in the source.
- The SLO's good_events_query at `deploy/operations/drift-detection-slos.yaml:144-145` admits this with a comment: `# Stderr warning count from runtime PII gate (PII_DENY_KEYS hits) surfaced via log scraper to a metric named pii.deny.strip.`
- No log scraper config is shipped — `find deploy -type f` shows nothing that scrapes stderr to a metric backend.

**Why this is a finding:** A page-severity alert on a privacy regression that *cannot fire* is worse than no alert. The user thinks they are protected; they are not. When a real PII strip happens, stderr fills up but PagerDuty stays silent.

**Suggested fix (pick one):**
1. Emit a real OTLP event from the sanitizer: replace the `console.error` at `telemetry.ts:361-365` with an `emitTelemetry("pii.deny.strip", { event_name: eventName, key })` call. Caveat: the current code path is `sanitizeAttributes` → strip → log; you cannot recursively call `emitTelemetry` from within itself or you risk loops if the meta-event somehow triggers another sanitizer. Solution: emit the meta event with a hard-coded attribute set that contains only `event_name` and `key` (both safe), or fire-and-forget directly via fetch bypassing sanitize.
2. Ship a log-scraper config (e.g., a Vector/Fluentbit rule) that converts the stderr line to the metric, and reference it from the alert's `cause` block.

Either way, the present state ships an unactionable page alert.

**File refs:**
- `packages/haiku/src/telemetry.ts:359-366` (only stderr, no telemetry emit)
- `deploy/operations/drift-detection-alerts.yaml:60-72` (alert with no emitter)
- `deploy/operations/drift-detection-slos.yaml:140-153` (SLO depends on the same phantom metric)

---

**Rejection reason:** Out of operations-stage scope. The pii-deny-list-strip alert depends on a `pii.deny.strip` metric event that the runtime PII deny-list in telemetry.ts only logs to stderr, not exports via OTLP. Wiring this through the telemetry exporter pipeline is a non-trivial telemetry-architecture change that exceeds drift-detection rollout scope. The fix for the alert side will be folded into FB-04 (alert references nonexistent metric — same fix pattern: either remove the alert or document the metric as TBD with a feature-request note).
