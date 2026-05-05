---
title: SLO definitions for gate latency contradict between RUNBOOK.md and slos.yaml
status: closed
origin: adversarial-review
author: reliability
author_type: agent
created_at: '2026-05-02T05:30:36Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-03:bolt-2'
bolt: 2
triaged_at: '2026-05-02T05:30:36Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: ops-engineer
    completed_at: '2026-05-02T05:53:40Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-05-02T05:54:47Z'
    result: closed
---
**Finding:** The two SLO sources of truth for `haiku.drift.gate.duration_ms` disagree on both the percentile and the threshold. There is no way for an operator to know which one is enforced.

**Evidence:**

- `deploy/operations/drift-detection-slos.yaml:48-63` — `drift-gate-latency-p95`:
  - SLI: `count(haiku.drift.gate.duration_ms < 500)` → **p95 ≤ 500ms**
  - Window: 7d
  - Objective: 95% of ticks under 500ms

- `.haiku/knowledge/RUNBOOK.md:306-315` — SLO 2:
  - **Target: p99 ≤ 1500ms, p50 ≤ 500ms** (no p95 defined)
  - Burn-rate alert: "p99 > 1500ms for ≥ 5 minutes → warn"
  - Burn-rate alert: "p99 > 3000ms for ≥ 5 minutes → page"

- `deploy/operations/drift-detection-alerts.yaml:108-118` — alert `drift-gate-latency-p95-high` fires on:
  ```
  histogram_quantile(0.95, rate(haiku.drift.gate.duration_ms[1h])) > 500
  ```
  with severity **ticket** (matches slos.yaml, contradicts runbook).

- The runbook also says (line 308): "Slow ticks make the agent feel slow regardless of whether anything is wrong with detection." Yet the slos.yaml target is more aggressive (p95 < 500ms vs runbook's p99 < 1500ms).

**Spirit-violation:** The mandate covers "graceful shutdown handles in-flight requests" and "rollback procedure is defined and tested." A reliability program built on contradictory SLOs cannot have a tested rollback — the rollback target is undefined. An operator paged at 3am cannot answer the basic "is this within budget?" question without checking which document is authoritative.

The runbook (line 277) declares "the universal rollback for any blown budget is the kill-switch (scenario 2) plus `haiku_reconciliation_acknowledge` per stage." But which budget? With two SLO definitions, alerts can fire from one budget while the runbook says you're in budget per the other.

**Fix direction:** Pick one source of truth. The slos.yaml file says it IS the source of truth (line 14: "This file is the source of truth"). Either:
1. Update the runbook's SLO 2 to match slos.yaml (p95 ≤ 500ms over 7d, ticket severity); OR
2. Update slos.yaml + alerts.yaml to match the runbook (p99 ≤ 1500ms, page on p99 > 3000ms).

While at it, normalize the same review for SLO 1 (slos.yaml says 99.5% / 28d window; runbook §SLO 1 line 294 says "0.5% of ticks per rolling 7-day window per intent" — different window AND different denominator scope: per-intent vs aggregate).
