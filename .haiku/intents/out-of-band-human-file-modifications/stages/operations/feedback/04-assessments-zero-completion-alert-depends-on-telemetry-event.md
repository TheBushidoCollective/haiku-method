---
title: >-
  assessments-zero-completion alert depends on telemetry event that does not
  exist
status: closed
origin: adversarial-review
author: reliability
author_type: agent
created_at: '2026-05-02T05:30:51Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-04:bolt-2'
bolt: 2
triaged_at: '2026-05-02T05:30:51Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: ops-engineer
    completed_at: '2026-05-02T05:55:40Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-05-02T05:56:58Z'
    result: closed
---
**Finding:** The `assessments-zero-completion` alert in `deploy/operations/drift-detection-alerts.yaml:171-187` fires when:
```
sum by (intent_slug, stage) (rate(haiku.drift.assessments.count[6h])) > 0
AND
sum by (intent_slug, stage) (rate(haiku.drift.assessments.resolved[6h])) == 0
```

The second metric, `haiku.drift.assessments.resolved`, **is not emitted anywhere in the source code**.

```
$ grep -rn "haiku.drift.assessments.resolved\|assessments.resolved" packages/haiku/src/
(no matches)
```

The alert's own `notes` field acknowledges this (line 186): "Resolution event TBD — flagged as future telemetry coverage gap. For now, alert is informational and may produce false positives." The runbook scenario `assessments-stuck` repeats the gap (RUNBOOK.md:740: "This alert depends on a `haiku.drift.assessments.resolved` event that does not yet exist.").

**Spirit-violation:** The mandate covers "retry and circuit-breaker patterns are configured for external dependencies." The alerting backend is an external dependency — and an alert that fires *every 6 hours forever* on every active intent because half its compound condition is permanently satisfied (rate of a never-emitted metric is always 0) is the textbook alert-fatigue cause SRE programs warn about. The alert does not just have a "false positive risk"; it has a **guaranteed-fire-forever** condition. Any oncall who silences it once will silence it every time, and the gap that is supposed to be transient becomes the operational norm.

**Evidence of the problem the alert is supposed to catch existing today:** It does — scenario 9 (drift assessments panel shows stale or empty) and scenario 10 (pending-marker store leak) are both real failure modes. The alert is well-intentioned. But shipping it without the metric to make it work is worse than not shipping it.

**Fix direction:** Either (a) actually emit `haiku.drift.assessments.resolved` from the dispatch-resolution path so the alert can work, OR (b) gate the alert on a `notes:` flag the alert backend understands to keep it dormant, OR (c) remove the alert from `alerts.yaml` and re-add it when the resolution event lands. Shipping a guaranteed-fire alert with a hand-wave note is operational debt with a paged price tag.
