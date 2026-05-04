---
title: >-
  No backoff or circuit breaker on baseline-corrupt path — flapping FS amplifies
  into telemetry storm
status: rejected
origin: adversarial-review
author: reliability
author_type: agent
created_at: '2026-05-02T05:31:11Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-02T05:31:11Z'
resolution: null
replies: []
---

**Finding:** When `readBaseline()` throws `BaselineCorruptError` (`drift-detection-gate.ts:435-454`), the gate emits `haiku.drift.baseline.corrupt` telemetry, returns `{findings: [], action: null}`, and lets the workflow continue. The **next** `haiku_run_next` tick re-enters the gate, re-reads the same corrupt baseline, re-throws, and re-emits. There is no backoff, no circuit breaker, and no record-of-recent-failure to suppress repeat emits.

**Spirit-violation:** The mandate explicitly requires "retry and circuit-breaker patterns are configured for external dependencies." The filesystem (where baseline.json lives) is the external dependency, and `readBaseline` is the call to it. A healthy reliability program treats the FS as a flaky dep. Today:

1. **Telemetry storm.** A persistently-corrupt baseline emits one `haiku.drift.baseline.corrupt` event PER tick, indefinitely. With multiple active intents and ~1 tick / few seconds of agent work, this floods the OTLP backend with duplicates and inflates the SLO 1 numerator (which counts these events) — the burn-rate alert fires from telemetry noise, not the underlying issue. Same root-cause, but instead of one paged event ("baseline X is corrupt") the operator sees a budget-burn alert that takes longer to triage.

2. **Same problem on `haiku.drift.baseline.write_failed`.** The post-write rethrow (`drift-detection-gate.ts:499-516` and `drift-detection-gate.ts:699-715`) has the same pattern — every retry re-attempts the write, re-fails, re-emits. No exponential backoff between failed writes on the same path.

3. **Same problem on reconciliation `write_failed`.** `upstream-reconciliation.ts` writes the fingerprint to `state.json` on every successful match; failure path emits unbounded.

**Why the rate-based alert isn't enough:** The runbook (line 373) explicitly justifies using rate-based alerts instead of single-event alerts because "single write failures are in budget — alerting on the symptom would generate noise." But the *gate itself* is the noise generator — it's emitting at tick frequency, not at fault frequency. The dedupe must happen at the source.

**Fix direction:** Add a tiny circuit-breaker layer in the gate:
- Keep an in-process `Map<intentDir+stage, {lastFailureSig, count, suppressUntilMs}>`.
- On a baseline-read or baseline-write failure, compute a signature `${errorCode}:${path}` and check the map. If the same sig fired in the last N seconds (e.g., N=30), suppress the telemetry emit but increment a `*_suppressed_count` counter.
- Emit the counter on either (a) the next tick where the failure clears, or (b) every Nth suppress for visibility. Pattern: "first failure pages, repeat failures within window dedupe, recovery shows the count."

This is the standard "circuit-breaker with half-open probe" pattern. Without it, the gate's reliability contract is "the FS is reliable" — which is exactly the assumption the mandate forbids.

---

**Rejection reason:** Out of operations-stage scope. Adding backoff/circuit-breaker semantics to the baseline-corrupt and write-failed paths is a substantial change to drift-detection-gate.ts behavior — it crosses the boundary from "operationalize the existing gate" (this stage) into "redesign the gate's failure semantics" (a follow-on reliability hardening intent). The kill-switch IS the universal rollback for telemetry-storm scenarios; documenting its use in that case is sufficient for this stage's scope. Real-world impact is also bounded: the gate runs once per haiku_run_next tick (not in a hot loop), so a flapping FS produces at most one failed write per user-driven action, not a sustained storm.
