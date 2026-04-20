---
title: >-
  Unit-16 FB-38 regression: `gray-*` tokens still in stage-progress-strip.html
  (13 occurrences)
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T09:26:26Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

Unit-16 gate 1 (FB-38) requires every `gray-*` Tailwind class to be replaced with its `stone-*` equivalent at the same shade number. Gate command: `grep -rn 'gray-' stages/design/artifacts/ | wc -l` MUST return 0. SPA artifacts use stone; server-rendered templates use gray, but design artifacts target the SPA.

Current state — `stages/design/artifacts/stage-progress-strip.html` has 13 live `gray-*` class occurrences at lines 361, 362, 370 (×3), 372 (×3), 379 (×2), 391, 392, 399, 400, 451, 452, 459, 460:

- `text-gray-900 dark:text-gray-100` (headings)
- `text-gray-500 dark:text-gray-400` (prose)
- `bg-white dark:bg-gray-900` / `border-gray-200 dark:border-gray-700` (cards)
- `bg-gray-50 dark:bg-gray-800` (table headers)
- `text-gray-500 dark:text-gray-400` (thead text)
- `divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300` (tbody)
- `bg-gray-50 dark:bg-gray-950` (code block)
- `text-gray-800 dark:text-gray-200` (pre code)
- `text-gray-700 dark:text-gray-300` (list items + prose)

This is a direct regression of the unit-16 gate. Every affected class must be rewritten to `stone-*` at the same shade: `gray-900→stone-900`, `gray-100→stone-100`, `gray-500→stone-500`, etc.

Fix: sweep the file section-by-section (§"Arrow-key roving tabindex (FB-65)" section from L359 onward) and replace every `gray-N` with `stone-N`. Re-run `grep -n 'gray-' stages/design/artifacts/stage-progress-strip.html` — must return 0. Stage-wide check: `grep -rn 'gray-' stages/design/artifacts/ | grep -v '\.md:'` must return 0.
