---
title: >-
  unit-31 contrast gates assert ratios (≥7:1, ≥10:1, 4.5:1) with no executable
  computation — prose-only WCAG check
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T15:30:03Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-31-contrast-and-type-scale-fixes.md
closed_by: null
bolt: 0
upstream_stage: null
---

File: `stages/design/units/unit-31-contrast-and-type-scale-fixes.md:30-40` (gate for assessor-summary-card), `:42-50` (gate for annotation-popover close ✕)

Gate text: "Post-fix contrast on forced-dark `bg-stone-900` is ≥ 7:1 (outer) / ≥ 10:1 (inner)" and "default state in dark now reaches ≥ 7:1 (`text-stone-400` #a8a29e on `dark:bg-stone-800` #292524 = 7.1:1)."

These are arithmetic claims with no executable test. `feedback-assessor` cannot falsify "≥ 7.1:1" by grep. The WCAG criterion this closes (FB-106 cites 1.4.3, FB-109 cites 1.4.3 + 1.4.11) is measurable, so the gate should include a measurable recipe — otherwise a future sweep that swaps `text-stone-400` for `text-stone-500` passes the grep but re-opens the WCAG defect.

**Proposed fix (diff-level):**

Replace the "≥ N:1" prose with token-level grep gates that encode the contrast-safe pairings directly:

```yaml
quality_gates:
  - >-
    `grep -nE 'text-stone-500[^"]*dark:bg-stone-800|dark:bg-stone-800[^"]*text-stone-500'
    stages/design/artifacts/annotation-popover-states.html` returns 0 hits
    (stone-500 on stone-800 is the FB-109 FAIL pattern).
  - >-
    `grep -nE 'text-stone-600[^"]*bg-stone-900|bg-stone-900[^"]*text-stone-600'
    stages/design/artifacts/assessor-summary-card.html` returns 0 hits (FB-106
    FAIL pattern). Same grep for `text-stone-500` bare without `dark:text-stone-3*`
    companion returns 0 hits on the header bullet (line 78) and timeout text
    (line 232).
  - >-
    For every remaining stone-text/stone-bg token pair in the two artifacts,
    run the shared audit script `scripts/wcag-contrast-check.sh
    stages/design/artifacts/assessor-summary-card.html
    stages/design/artifacts/annotation-popover-states.html` — exit code 0
    confirms every detected pair ≥ 4.5:1 body text / ≥ 3:1 non-text UI.
```

If no `scripts/wcag-contrast-check.sh` exists, the unit should either (a) cite the canonical pairs table in `contrast-and-type-audit.md §1.1` and grep for presence of the canonical companion, or (b) add a unit-scoped script stub in the Approach section that future iterations can fill in. "Manual walk confirms ≥ 7:1" is not a gate.
