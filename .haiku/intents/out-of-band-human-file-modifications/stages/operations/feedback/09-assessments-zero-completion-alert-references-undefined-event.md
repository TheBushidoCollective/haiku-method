---
title: >-
  assessments-zero-completion alert references undefined event
  haiku.drift.assessments.resolved
status: rejected
origin: adversarial-review
author: observability
author_type: agent
created_at: '2026-05-02T05:31:41Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-02T05:31:41Z'
resolution: null
replies: []
---

**Mandate violation:** "alerts have clear runbooks or at minimum actionable descriptions" — the alert at `deploy/operations/drift-detection-alerts.yaml:171-188` (`assessments-zero-completion`) is unactionable because half its expression depends on an event that is never emitted.

**Evidence:**
- Alert expression at line 181-184:
  ```
  sum by (intent_slug, stage) (rate(haiku.drift.assessments.count[6h])) > 0
  AND
  sum by (intent_slug, stage) (rate(haiku.drift.assessments.resolved[6h])) == 0
  ```
- Code search: `grep -rn "assessments.resolved" packages/haiku/src/` returns zero hits. The event `haiku.drift.assessments.resolved` is never emitted by any code path.
- The alert author knew this — line 186-187 says: `Resolution event TBD — flagged as future telemetry coverage gap.`
- The runbook at `.haiku/knowledge/RUNBOOK.md:740` repeats the admission: "This alert depends on a `haiku.drift.assessments.resolved` event that does not yet exist."

**Why this is a finding:** Shipping an alert that tautologically fires on every intent that ever dispatched an assessment (because `resolved` is permanently 0) is alert fatigue by construction. Either:
1. Remove the alert until the resolution event is emitted, OR
2. Emit `haiku.drift.assessments.resolved` from the dispatch handler at `packages/haiku/src/orchestrator/workflow/handlers/manual-change-assessment.ts` and `packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts:729` (where `haiku.assessment.recorded` already fires — emit `assessments.resolved` in the same place when classification completes).

**File refs:**
- `deploy/operations/drift-detection-alerts.yaml:171-188`
- `.haiku/knowledge/RUNBOOK.md:722-744`
- `packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts:729` (where the resolution event should fire)

---

**Rejection reason:** Duplicate of FB-04. Both findings flag the same root cause: assessments-zero-completion alert in deploy/operations/drift-detection-alerts.yaml depends on `haiku.drift.assessments.resolved`, a metric no code path emits. FB-04 (reliability lens) will drive the fix; rejecting this duplicate prevents a redundant fix-loop dispatch.
