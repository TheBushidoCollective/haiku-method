---
title: >-
  "OOM-synthetic" naming contradicts implementation and obscures the actual
  fault mode
status: closed
origin: adversarial-review
author: reliability
author_type: agent
created_at: '2026-05-02T05:31:32Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-07:bolt-2'
bolt: 2
triaged_at: '2026-05-02T05:31:32Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: ops-engineer
    completed_at: '2026-05-02T05:55:35Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-05-02T05:57:25Z'
    result: closed
---
**Finding:** Multiple operations artifacts (alerts.yaml `drift-surface-oom-synthetic`, slos.yaml `drift-surface-size-bound`, RUNBOOK.md `drift-oom-synthetic`) describe a synthetic-baseline downgrade as triggered by "Surface size exceeded the in-memory baseline threshold." The actual implementation at `drift-detection-gate.ts:756-799` triggers on a completely different condition: `findings.length > effectiveSurfaceSize * 0.5` (more than 50% of the surface drifted).

**Spirit-violation:** The mandate covers "rollback procedure is defined and tested." When operators are paged on `drift-surface-oom-synthetic`, the runbook tells them to "prune accumulated cruft" or accept that "the intent is genuinely large" — which addresses *surface size*. But the gate fires on *drift volume*, not surface size. The operator's diagnostic trail leads to the wrong remediation.

**Evidence:**

- Implementation (`drift-detection-gate.ts:756-764`):
  ```
  // 9. Out-of-sync heuristic (ARCHITECTURE.md §8.3):
  //    When > 50% of the effective surface has drifted, emit a single
  //    synthetic finding instead of the full list.
  const effectiveSurfaceSize = Math.max(surface.length, baseline.entries.size, 1)
  if (findings.length > 0 && findings.length > effectiveSurfaceSize * 0.5) {
  ```

- alerts.yaml line 137-144 — `drift-surface-oom-synthetic` cause: "Surface size exceeded the in-memory baseline threshold; gate downgraded to one synthetic finding per stage."

- slos.yaml line 117-130 — `drift-surface-size-bound` rationale: "above the threshold, the gate downgrades to a synthetic-OOM baseline." SLI: `count(haiku.drift.surface.size) - count(haiku.drift.baseline.oom_synthetic)`. This SLI is meaningless because `oom_synthetic` is not correlated with `surface.size` — it's correlated with *drift count vs surface*, which is a different signal.

- RUNBOOK.md line 656-664 — diagnostic step: "What is the surface size for that intent/stage? `haiku.drift.surface.size` gives the count." Wrong diagnostic. The surface might be small; the trigger is mass drift (a `git rebase`, a bulk regenerate, a refactor that touched > 50% of tracked files).

**Why this matters operationally:** The genuine fault mode (mass drift on a small surface — e.g., a regen script touched 30 of 40 files) is invisible to the operator following the runbook. They prune cruft, surface size doesn't change, alert keeps firing, they conclude the alert is broken. Meanwhile the actual cause (someone regenerated half the codebase out-of-band) is the exact thing this entire feature exists to detect.

**Fix direction:** Rename `haiku.drift.baseline.oom_synthetic` → `haiku.drift.findings.mass_drift_synthesized` (or similar) and rewrite the alert / SLO / runbook around the real condition. The "OOM" framing is a leftover from an earlier design where the threshold was a memory cap, but the implementation never matched that. Either:
1. Implement the OOM threshold the docs describe (a real `effectiveSurfaceSize > MAX_FILES` cutoff, separate event); OR
2. Rename + redocument what's actually shipping.

The current state — alerts, SLOs, and runbook all describing a feature the code doesn't have — is a reliability-program failure mode, not a small naming nit.
