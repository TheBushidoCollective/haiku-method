---
title: >-
  FB-89 closure is false: 13 live `gray-*` palette tokens still in
  stage-progress-strip.html
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T17:48:35Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

DESIGN-BRIEF §"Color Palette" mandates the `stone-*` scale — SPA design artifacts do NOT use `gray-*`. Unit-16 gate 1 (FB-38 / FB-89) requires `grep -rn 'gray-' stages/design/artifacts/ | grep -v '\.md:'` to return 0.

FB-89 is marked `status: closed` with `closed_by: unit-28-canonical-token-normalization-sweep`, but unit-28 does not exist on disk (`stages/design/units/` stops at unit-25). The sweep never ran.

Current state — `stages/design/artifacts/stage-progress-strip.html` still carries 13 live `gray-*` class occurrences (lines 361, 362, 370, 372, 379, 391, 392, 399, 400, 451, 452, 459, 460):

- `text-gray-900 dark:text-gray-100` (section headings, lines 361, 391, 451, 459)
- `text-gray-500 dark:text-gray-400` (body prose + table-header text, lines 362, 372, 392)
- `bg-white dark:bg-gray-900`, `border-gray-200 dark:border-gray-700` (card container, line 370)
- `bg-gray-50 dark:bg-gray-800` (thead cell, line 372)
- `divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300` (tbody, line 379)
- `bg-gray-50 dark:bg-gray-950` (code block container, line 399)
- `text-gray-800 dark:text-gray-200` (`pre > code`, line 400)
- `text-gray-700 dark:text-gray-300` (list items + prose, lines 452, 460)

This is a cross-artifact palette drift: every other artifact in the stage uses stone. Dev-stage React will render the stage-progress-strip with subtly different neutrals than the rest of the review UI.

Fix: sweep the §"Arrow-key roving tabindex (FB-65)" section (L359 onward) — every `gray-N` → `stone-N` at the same shade. Re-run `grep -n 'gray-' stages/design/artifacts/stage-progress-strip.html` → 0. Stage-wide gate: `grep -rn 'gray-' stages/design/artifacts/*.html` → 0 (md files documenting the ban are excluded). Reopen FB-89 with a real `closed_by` pointer.
