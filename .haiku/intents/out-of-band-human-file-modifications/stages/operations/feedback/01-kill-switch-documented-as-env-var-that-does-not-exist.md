---
title: Kill-switch documented as env var that does not exist
status: closed
origin: adversarial-review
author: reliability
author_type: agent
created_at: '2026-05-02T05:30:00Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-01:bolt-2'
bolt: 2
triaged_at: '2026-05-02T05:30:00Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: ops-engineer
    completed_at: '2026-05-02T05:52:09Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-05-02T05:53:11Z'
    result: closed
---
**Finding:** The runbook and alerts file instruct operators to engage the drift-gate kill-switch via the environment variable `HAIKU_DRIFT_GATE_DISABLED=1`, but **this env var is not read anywhere in the source code**. The actual kill-switch is `drift_detection: false` in `.haiku/settings.yml` (read by `isDriftDetectionDisabled()` at `packages/haiku/src/orchestrator/workflow/drift-baseline.ts:723`).

**Spirit-violation:** The reliability mandate requires "rollback procedure is defined and tested." A documented rollback that does nothing is worse than no rollback — the operator believes the gate is silenced, walks away, and the failure mode keeps burning. This is a paged-at-3am footgun.

**Evidence (contradictory references):**

- `deploy/operations/drift-detection-alerts.yaml:161` — `kill-switch-engaged` alert says: "`HAIKU_DRIFT_GATE_DISABLED=1` or equivalent triggered the kill switch path."
- `.haiku/knowledge/RUNBOOK.md:608` — escalation step: "consider engaging kill switch to stop the budget bleed while you investigate (`HAIKU_DRIFT_GATE_DISABLED=1`)"
- `.haiku/knowledge/RUNBOOK.md:610` — rollback step: "Re-enable the gate (`unset HAIKU_DRIFT_GATE_DISABLED`)"
- `.haiku/knowledge/RUNBOOK.md:697` — kill-switch-engaged scenario: "`HAIKU_DRIFT_GATE_DISABLED=1` (or equivalent) is set in the MCP environment"
- `.haiku/knowledge/RUNBOOK.md:711-713` — remediation: "`unset HAIKU_DRIFT_GATE_DISABLED`"
- Source: `grep -rn "HAIKU_DRIFT_GATE_DISABLED" packages/haiku/src/` returns **zero matches**.

The earlier scenario in the same runbook (Scenario 2, line 59) correctly documents `drift_detection: false` in `.haiku/settings.yml`. The contradiction is internal to the runbook itself.

**Fix direction:** Pick one mechanism and replace every reference. Either:
1. Add an env-var path inside `isDriftDetectionDisabled()` that respects `HAIKU_DRIFT_GATE_DISABLED=1` (env var is faster to engage than editing settings.yml — better for paged operators), and keep both options documented; OR
2. Strip every `HAIKU_DRIFT_GATE_DISABLED` reference from the runbook + alerts.yaml and standardize on `drift_detection: false`.

The "(or equivalent)" hedge in the runbook does not save it — the operator needs the literal command to copy-paste at 3am.
