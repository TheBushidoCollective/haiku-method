---
title: RUNBOOK.md has duplicated/conflicting sections from two merged authors
status: closed
origin: adversarial-review
author: reliability
author_type: agent
created_at: '2026-05-02T05:31:53Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-10:bolt-2'
bolt: 2
triaged_at: '2026-05-02T05:31:53Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: ops-engineer
    completed_at: '2026-05-02T05:59:02Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-05-02T06:01:18Z'
    result: closed
integrator_attempts: 1
---
**Finding:** `.haiku/knowledge/RUNBOOK.md` is structurally two runbooks concatenated at line 441. The file contains:

- Lines 1-440: scenario-driven runbook (Scenarios 1-11, SLOs 1-5, Alerting rules table)
- Line 441: `# Drift Detection — Operational Runbook` (a duplicate H1 heading)
- Lines 441-744: alert-anchor-driven runbook (`drift-gate-baseline-corrupt`, `drift-gate-write-failed`, ...)

Some content is duplicated, some contradicts:

**Duplicate content:**
- Healthy baseline definition appears at lines 281-290 AND lines 445-450 with overlapping but non-identical text.
- Kill-switch remediation appears in Scenario 2 (lines 53-69, uses `drift_detection: false`) AND in `kill-switch-engaged` (lines 693-720, uses `HAIKU_DRIFT_GATE_DISABLED=1`). These are different mechanisms (see separate finding on the env-var that doesn't exist).
- Baseline-corrupt remediation appears in Scenario 3 (lines 73-92, says "Run `haiku_repair`") AND in `drift-gate-baseline-corrupt` (lines 452-493, says "git checkout HEAD -- $BASELINE" or `mv "$BASELINE" "${BASELINE}.corrupt.$(date +%s)"`). The two paths are not the same; either could be "right" but the operator can't tell which to follow.

**Orphaned line:**
- Line 434-437 are bullet points about "Sentry project `haiku-spa`" / "MCP errors: Sentry project `haiku-mcp`" / "Tunnel health" / "Drift detection telemetry" with no preceding heading. These appear to be the tail of a different operational doc that got merged in.

**Spirit-violation:** The mandate requires "rollback procedure is defined and tested." A rollback procedure that has two different remediation paths in two different sections of the same file is, by definition, untested — at most one path was actually executed. The duplicated content is also a maintenance hazard: when the gate behavior changes, only one section will get updated, and the operator following the stale section will execute the wrong remediation.

**Evidence:**
```
$ grep -n "^# " .haiku/knowledge/RUNBOOK.md
1:# Drift Detection — Operational Runbook
441:# Drift Detection — Operational Runbook
```

Two identical H1 headings in the same file. The unit-01 spec at `.haiku/intents/.../stages/operations/units/unit-01-operational-runbook.md` says "the deliverable already exists on this branch from a prior execution that was lost when the workflow phase tracker reset" — this is what an unmerged duplicate from two execution rounds looks like.

**Fix direction:** Pick one organizational scheme:
1. Merge into the Scenarios + SLOs + Alerts-table format (lines 1-440 are the most cohesive structure); fold the alert-anchor sections (lines 441-744) into the existing Scenarios using cross-references.
2. OR keep the alert-anchor style (the second half maps cleanly to alert IDs in `drift-detection-alerts.yaml` per the unit-01 cross-artifact contract); fold the scenarios into it.

Either is fine. The current state is not — every orienting reader has to figure out which half is canonical.
