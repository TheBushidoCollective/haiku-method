---
title: >-
  unit-27 AssessorSummaryCard §2 spec Props ignore FB-106 dark-mode contrast
  fixes landing in unit-31
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:33:12Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-27-spec-alignment-and-design-brief-completeness.md
closed_by: unit-27-spec-alignment-and-design-brief-completeness
bolt: 0
upstream_stage: null
---

`stages/design/units/unit-27-spec-alignment-and-design-brief-completeness.md` quality gate 3 (line 57-83) authors the DESIGN-BRIEF §2 spec for `AssessorSummaryCard`. The canonical Tailwind base class it prescribes is:

> "`bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm p-6`"

The spec describes only the container, not the internal copy colors. Meanwhile `stages/design/units/unit-31-contrast-and-type-scale-fixes.md` (FB-106) is simultaneously rewriting `assessor-summary-card.html` lines 73, 78, 160, 232 — each swapping bare `text-stone-*` for the canonical pair `text-stone-600 dark:text-stone-300`.

If unit-27's §2 spec lands without referencing the canonical text-color pair that unit-31 is pinning in the HTML, dev-stage React will ship the Props interface + base class but miss the internal copy color rule. The spec will be read as "any text color is fine" which reintroduces the exact FB-106 regression.

Proposed fix: unit-27 quality gate 3(a) (AssessorSummaryCard spec) should extend the Props / states section with an explicit text-color contract pointing at unit-31's canonical pair:

```
States / internal copy:
- Header bullet: `text-stone-400` (outer) + `text-stone-300` (inner) on dark;
  `text-stone-600` + `text-stone-500` on light (matches unit-31 FB-106 fix).
- Subagent-timeout error text: `text-stone-600 dark:text-stone-300` pair.
- Per-item bullet list copy: `text-stone-600 dark:text-stone-300` pair.

Cross-ref: `unit-31-contrast-and-type-scale-fixes.md` quality gate 1.
```

This also means unit-27 and unit-31 share authority over `AssessorSummaryCard` shape — add `depends_on: [unit-31]` to unit-27 or explicitly note the cross-ref in the §2 spec to avoid drift.
