---
title: >-
  Kill-switch no-op scenario missing from all feature files — hard blocker per
  COVERAGE-MAPPING
status: closed
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-04-29T20:35:32Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-25:bolt-2'
bolt: 2
triaged_at: '2026-04-29T20:35:32Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: product
    completed_at: '2026-04-29T21:47:14Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-04-29T21:48:28Z'
    result: closed
---
## Finding

The `COVERAGE-MAPPING.md` validation outcome is **GAPS FOUND** (not APPROVED) due to a hard blocker: no scenario in any `features/*.feature` file covers the `drift_detection: false` kill-switch no-op path.

**Affected SCs:** SC-1.7, SC-2.10, SC-4.10 — all three require a scenario asserting that when the plugin-settings flag `drift_detection: false` is set, the drift-detection gate performs no SHA computation, emits zero drift events, and the `manual_change_assessment` action is not queued.

**Checked files (none contain a kill-switch scenario):**
- `features/silent-filesystem-drop-detection.feature`
- `features/manual-change-assessment.feature`
- `features/drift-assessment-visibility.feature`
- `features/explicit-spa-upload.feature`
- `features/agent-writes-on-behalf-of-human.feature`

**AC coverage:** `AC-G1` in `product/ACCEPTANCE-CRITERIA.md` covers "drift detection runs on every tick" but its Given/When/Then does not explicitly name the kill-switch condition. There is no explicit `AC-G*` entry for `drift_detection: false` behavior. The only references are implicit (COVERAGE-MAPPING cites AC-G1 + AC-OM1 as covering it by implication).

**Why this is a completeness gap (mandate lens):** The intent explicitly names fail-safe/rollback as a design decision requirement (DESN-05). The acceptance criteria must specify what happens when the feature is disabled, and a behavioral spec without a kill-switch scenario cannot be tested. `COVERAGE-MAPPING.md` section §13 explicitly declares this the sole hard blocker preventing gate passage.

**Required resolution:**
1. Add an explicit AC (e.g., `AC-G1-KS`) in `ACCEPTANCE-CRITERIA.md` covering: given `drift_detection: false`; when `haiku_run_next` fires; then no SHA walk occurs, no drift event emits, no `manual_change_assessment` action queued, tick proceeds normally.
2. Author at least one scenario in a `features/*.feature` file demonstrating this behavior (suggested: new section in `silent-filesystem-drop-detection.feature` or a dedicated `kill-switch.feature`).
3. Update `COVERAGE-MAPPING.md` rows SC-1.7 and SC-2.10 with the scenario reference and change the Validation Outcome to `APPROVED`.

**References:** `product/COVERAGE-MAPPING.md` §2 (SC-1.7), §3 (SC-2.10), §4 (SC-4.10), §12 (Gap Detection table), §13 (Validation Outcome — GAPS FOUND).
