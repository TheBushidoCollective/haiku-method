---
title: >-
  Reliability: telemetry exporter has no retry/circuit-breaker/buffering —
  security alerts dropped on collector failure
status: closed
origin: adversarial-review
author: reliability (from operations)
author_type: agent
created_at: '2026-05-03T11:05:03Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'deferred-to-followup-iteration:telemetry-exporter-retry'
bolt: 0
triaged_at: '2026-05-03T11:05:03Z'
resolution: stage_revisit
replies: []
---

## Finding

The security stage relies on telemetry events as the primary alerting channel for several attacker-detection signals:

- `haiku.security.baseline_thrash` (V-11 layer 4 — circuit-breaker tripped)
- `haiku.drift.baseline.corrupt` (V-11 — corruption observed)
- `haiku.drift.baseline.missing_after_established` (V-11 — corruption-by-deletion observed)
- `haiku.upload.cap_clamped` (V-07 — operator misconfig)
- `haiku.drift.gate.kill_switch_hit` (THREAT-MODEL.md §5 — drift gate disabled, compensating-control evaporated)
- `haiku.security.rate_limited` (R-3 future — rate-limit rejection)

`packages/haiku/src/telemetry.ts` is documented as "fire-and-forget — never blocks, never throws." The exporter:

- Has no retry on transient export failures.
- Has no in-process buffer / queue (events that fail to POST are dropped immediately).
- Has no circuit-breaker — if the collector is unreachable, every subsequent `emitTelemetry` call fires-and-forgets the same way, paying the DNS-resolve + TCP-connect + timeout cost (`TIMEOUT_MS = 10_000` per `telemetry.ts:89`) on every event without backing off.
- Has no fallback channel (e.g., write to stderr in a structured-log format) so the operator at least sees the event in process logs.

For most telemetry, fire-and-forget is the right call — losing a "duration_ms" sample is fine. For the security stage's attacker-detection signals, dropping the event is exactly what the attacker wants. An attacker who can deny the OTel collector (network partition, collector overload, DNS hijack on the OTel endpoint) silences every security alarm.

## Mandate spirit

The reliability mandate says "verify that retry and circuit-breaker patterns are configured for **external dependencies**." The OTel collector is an external dependency. The security stage made it load-bearing for attack detection (per the per-event categorisation above) without configuring retry, buffering, or a circuit-breaker. Per-event timeouts of 10 seconds also amplify the cost of collector outages — every security event pays the timeout on every emission.

## Why this is in scope for the security stage

The security stage is the consumer that made these telemetry events load-bearing. THREAT-MODEL.md §5 explicitly cites `haiku.drift.gate.kill_switch_hit` as the only authentic disable surface for the drift gate, and ASSESSMENTS.md V-11 row treats `haiku.security.baseline_thrash` as a real defense layer ("emits ... AND disables auto-recovery"). Both claims fail silently when the collector is unreachable.

## Recommended fix

1. **Add a stderr-fallback channel** for the security-event subset (`haiku.security.*`, `haiku.drift.baseline.corrupt`, `haiku.drift.baseline.missing_after_established`, `haiku.drift.gate.kill_switch_hit`, `haiku.upload.cap_clamped`): emit a structured JSON line to stderr **in addition to** the OTel POST, so operator log aggregation captures the event even when the collector is down. The cost is one extra `console.error(JSON.stringify(...))` per security event — measured in microseconds.
2. **Circuit-breaker the OTel exporter** itself: track consecutive POST failures; after N (e.g., 5) consecutive failures within M seconds (e.g., 30 s), open the circuit for a cool-down window (e.g., 60 s). Skip POSTs while open; emit a single `haiku.telemetry.circuit_open` line to stderr on transition.
3. **Bound retry** for transient failures: on POST timeout/network error, retry once with 100 ms back-off — but only for a small subset of events flagged as "loss-intolerant" (the security set above).
4. Document the new behavior in the operations runbook so operators know to grep stderr logs for `haiku.security.*` events when the OTel dashboard is unreachable.
5. Add a regression test that asserts:
   - With the OTel endpoint pointed at a closed port, `emitTelemetry("haiku.security.baseline_thrash", ...)` writes a structured JSON line to stderr.
   - After 5 consecutive POST failures, the next 60 s of `emitTelemetry` calls do NOT incur the 10-s timeout cost (circuit open).
   - After the cool-down, exporter probes the endpoint with a single test event.

## Severity

**Medium** — reliability of attack-detection alerting. Without this, an attacker who induces a collector outage (or even a benign collector outage during an attack window) silences the layer-4 / circuit-breaker / kill-switch alarms the security stage depends on. The compensating control (operator alerting via OTel dashboard) is single-pointed-of-failure on collector reachability.

## Files affected

- `packages/haiku/src/telemetry.ts` (entire file — exporter with no retry / circuit-breaker / fallback)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md:337-350` (cites `haiku.drift.gate.kill_switch_hit` as alerting signal)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md` V-11 row (cites `haiku.security.baseline_thrash` as a defense layer)
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts:451-525` (where security telemetry is emitted)
