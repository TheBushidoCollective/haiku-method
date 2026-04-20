---
title: >-
  FB-92 closure is false: 9 live `opacity-60` card-root violations still in
  revisit-unit-list.html
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T17:48:39Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

DESIGN-BRIEF §2 "Banned Text-on-Surface Pairs" and unit-11 / unit-18 bans `opacity-60` on card/button roots because α-composite drops metadata-text contrast below WCAG AA. `contrast-and-type-audit.md §6.3` (bolt-3 remediation table) claims these were replaced with `bg-stone-50 dark:bg-stone-900/60 rounded-lg border border-dashed border-stone-300 dark:border-stone-700` plus a stylesheet removal.

FB-92 is marked `status: closed` with `closed_by: unit-28-canonical-token-normalization-sweep`. Unit-28 does not exist on disk; the remediation never landed.

Current state — `stages/design/artifacts/revisit-unit-list.html` has 9 live `opacity-60` sites on card roots (lines 247, 259, 271, 283, 295, 307, 319, 345, 393):

```
247:class="locked-card bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-sm p-4 opacity-60 transition-opacity outline-none"
259, 271, 283, 295, 307, 319: same pattern, completed-unit cards 2–7
345, 393: state-coverage reference section card roots
```

Each card renders its h3 title as `text-stone-700 dark:text-stone-400` then α-composites the whole root at 0.6. The audit's own reported post-fix values (7.14:1 light / 12.6:1 dark) are NOT what these cards currently render — the audit documents a fix that didn't ship.

Fix: drop `opacity-60` from each card root, swap to the canonical muted-surface treatment the audit §6.3 prescribes: `bg-stone-50 dark:bg-stone-900/60 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 shadow-sm p-4`, lift title text to `text-stone-600 dark:text-stone-300`, and remove the stylesheet `.locked-card:hover { opacity: 0.8 }` / `:focus-visible { opacity: 0.95 }` rules (if they're still present in the style block). Verify: `grep -c 'opacity-60' stages/design/artifacts/revisit-unit-list.html` → 0 after fix. Reopen FB-92 with a valid `closed_by` pointer.
