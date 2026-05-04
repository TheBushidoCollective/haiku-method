---
title: >-
  Latency metrics emitted as info logs, not histograms — histogram_quantile()
  will not work
status: rejected
origin: adversarial-review
author: observability
author_type: agent
created_at: '2026-05-02T05:32:29Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-02T05:32:29Z'
resolution: null
replies: []
---

**Mandate violation in spirit:** "metrics cover the four golden signals (latency, …)" — latency is one of the four. The implementation emits latency as a single OTLP log record per tick, but the alerts and SLOs query it via `histogram_quantile()`, which is a Prometheus aggregator over histogram-typed series. There is no histogram here.

**Evidence:**
- `packages/haiku/src/telemetry.ts:376-431` `emitTelemetry()` constructs a single `logRecords[]` payload with `severityNumber: 9, severityText: "INFO"` for every event including `haiku.drift.gate.duration_ms`. There is no `Histogram` instrument, no `record(value)` call, no bucket boundaries, no `_bucket`/`_sum`/`_count` series.
- Alert at `drift-detection-alerts.yaml:117` invokes `histogram_quantile(0.95, rate(haiku.drift.gate.duration_ms[1h]))`. That returns NaN against log records.
- SLO 2 at `drift-detection-slos.yaml:48-58` SLI query is `count(haiku.drift.gate.duration_ms < 500)` — this also doesn't work against log records (there is no comparison-on-attribute aggregation in OTLP-log query languages without an intermediate processor).

**Why this is a finding:** The latency dimension of the four golden signals is *not actually observable* with the present pipeline. The duration_ms attribute flows through as a string, attached to a log body. To make the alerts queryable as designed, the OTLP collector / backend would need a log-to-metric translator (e.g., OTel collector `transform` processor + `metricsgenerationprocessor`), and that translator config is not shipped under `deploy/`.

**Suggested fix (pick one):**
1. Emit duration_ms via the OTLP metrics signal as an explicit-bucket histogram. Add a sibling `emitHistogram` to `telemetry.ts` that posts to `/v1/metrics` instead of `/v1/logs`. The alerts then just work.
2. Document the required OTel-collector pipeline (log → metric conversion) and ship the collector config under `deploy/operations/otel-collector.yaml`. Reference it from the alerts file's header comment.
3. Replace `histogram_quantile()` and `count(... < 500)` in the alerts/SLOs with whatever aggregation actually works against log records in the chosen backend (e.g., Sentry `count_if(duration_ms < 500)` style); document that the alerts are backend-specific.

**File refs:**
- `packages/haiku/src/telemetry.ts:376-431` (only emits to /v1/logs)
- `deploy/operations/drift-detection-alerts.yaml:117,129` (queries assume histogram)
- `deploy/operations/drift-detection-slos.yaml:54-56,72-73` (SLIs assume comparison-on-value)

---

**Rejection reason:** Out of operations-stage scope. Migrating telemetry from log-record emit (current emitTelemetry pattern) to histogram emit (required for histogram_quantile() SLI queries) is an architectural change to the telemetry pipeline that affects every existing emit site, not just drift detection. This belongs in a follow-on telemetry-architecture intent. The fix for the alert side will be folded into the FB-04 / FB-13 fix loops (rewrite the latency alerts to use whatever query shape the current log-record pipeline can actually serve, or document them as TBD).
