---
title: >-
  Latency alerts collapse all intents into one series — operator cannot identify
  which intent is slow
status: closed
origin: adversarial-review
author: observability
author_type: agent
created_at: '2026-05-02T05:32:12Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-13:bolt-2'
bolt: 2
triaged_at: '2026-05-02T05:32:12Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: ops-engineer
    completed_at: '2026-05-02T05:51:56Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-05-02T05:53:17Z'
    result: closed
---
**Mandate violation in spirit:** "metrics cover the four golden signals (latency, traffic, errors, saturation)" — and the unit-02 cross-artifact contract on `unit-02-telemetry-coverage` body says alerts MUST aggregate `by (intent_slug, stage)` so the operator knows which intent caused the page. Two latency alerts violate this.

**Evidence:**
- `deploy/operations/drift-detection-alerts.yaml:117`:
  ```
  histogram_quantile(0.95, rate(haiku.drift.gate.duration_ms[1h])) > 500
  ```
  No `by (intent_slug, stage)` clause and no template-string annotation referencing those labels.
- Same problem at line 129:
  ```
  histogram_quantile(0.95, rate(haiku.reconciliation.fingerprint.duration_ms[1h])) > 750
  ```
- Compare the cause-class alerts (lines 28, 43, 57, 143, 154, 165, 181, 183) which all correctly carry `sum by (intent_slug, stage)`. The latency alerts are the outliers.

**Why this is a finding:** A page that fires "drift gate p95 latency > 500ms" with no per-intent attribution makes the operator open the OTLP backend and *re-aggregate* manually before they can act. At 3am that is the difference between a 2-minute fix (one intent has a runaway knowledge dir) and a 30-minute investigation. The unit's own cross-artifact contract says this is a regression; the contract was authored to prevent this exact failure.

**Suggested fix:** Wrap both `histogram_quantile` calls in a `by (intent_slug, stage)` aggregation:
```
histogram_quantile(0.95, sum by (intent_slug, stage, le) (rate(haiku.drift.gate.duration_ms_bucket[1h]))) > 500
```
(Adjusted for histogram metric semantics — the implementation depends on whether you ship histograms or summaries; either way the labels must reach the alert payload.)

**File refs:**
- `deploy/operations/drift-detection-alerts.yaml:108-118` (drift-gate-latency-p95-high)
- `deploy/operations/drift-detection-alerts.yaml:120-130` (reconciliation-fingerprint-latency-p95-high)
- Unit body `.haiku/intents/out-of-band-human-file-modifications/stages/operations/units/unit-02-telemetry-coverage.md` cross-artifact contract paragraph: "Every alert rule whose underlying metric carries the correlation triple MUST either aggregate `by (intent_slug, stage)` or include `{{ $labels.intent_slug }}`"
