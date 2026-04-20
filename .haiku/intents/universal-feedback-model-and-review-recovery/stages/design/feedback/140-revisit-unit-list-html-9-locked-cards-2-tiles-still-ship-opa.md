---
title: >-
  revisit-unit-list.html 9 locked cards + 2 tiles still ship opacity-60 — FB-92
  falsely closed — 1.4.3 FAIL
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T17:51:19Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

`revisit-unit-list.html` still renders the banned opacity-as-state pattern on nine `.locked-card` surfaces plus two state-coverage reference tiles, directly contradicting `contrast-and-type-audit.md §6.3` bolt-3 remediation claim AND the FB-92 closure marker (closed_by: unit-26-artifact-opacity-ban-enforcement).

**Live violations (grep verified 2026-04-20):**

- `revisit-unit-list.html:247` — `<div tabindex="0" role="article" aria-label="Completed unit..." class="locked-card bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-sm p-4 opacity-60 transition-opacity outline-none">` (unit-01)
- `revisit-unit-list.html:259, 271, 283, 295, 307, 319` — same pattern for units 02–07 (six more identical cards).
- `revisit-unit-list.html:345` — state-coverage reference tile "Default (locked, opacity 60%)" with `opacity-60 transition-opacity`.
- `revisit-unit-list.html:393` — second state-coverage reference tile with `opacity-60`.

**Contrast math (α-composite):**

- Light mode: title `text-stone-700` (#44403c) × 0.6 α over `bg-white` → effective ≈ #978e86 on white → ratio ~3.9:1 — FAIL body text (AA ≥ 4.5:1).
- Dark mode: title `text-stone-400` (#a8a29e) × 0.6 α over `bg-stone-900` (#1c1917) → effective ≈ #625d57 on #1c1917 → ratio ~2.9:1 — FAIL body text.

**Additional violation in the same file:**

- Lines ~240 and ~398 — read-only pill uses `bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-400`. `text-stone-500` on `bg-stone-200` is 2.66:1 — FAIL. Matches QG2 banned-disabled-pattern grep literal `bg-stone-200 text-stone-500`.

**What audit + closed feedback claim vs. reality:**

- `contrast-and-type-audit.md §6.3` bolt-3 row 1 claims these 7 rendered cards were rewritten to `bg-stone-50 dark:bg-stone-900/60 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 shadow-sm p-4 outline-none` with `text-stone-600 dark:text-stone-300` titles; stylesheet `.locked-card:hover { opacity: 0.8 }` and `:focus-visible { opacity: 0.95 }` rules removed.
- The file still ships original markup verbatim on every one of those lines. FB-92 was marked `closed_by: unit-26-artifact-opacity-ban-enforcement` — unit-26 did not land the rewrite that FB-92 described.

**Fix required:**

1. Rewrite every `.locked-card` root at lines 247, 259, 271, 283, 295, 307, 319, 345, 393 to drop `opacity-60 transition-opacity` and use `bg-stone-50 dark:bg-stone-900/60 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 shadow-sm p-4` as the muted-surface treatment.
2. Lift every locked-card `<h3>` title from `text-stone-700 dark:text-stone-400` to `text-stone-600 dark:text-stone-300` (full opacity on new muted background: 7.14:1 light / 12.6:1 dark).
3. Remove `.locked-card:hover { opacity: 0.8 }` and `:focus-visible { opacity: 0.95 }` stylesheet rules (second-order opacity bumps still in the `<style>` block).
4. Raise the read-only pill text from `text-stone-500` to `text-stone-700`/`dark:text-stone-300` (FB-92's proposed fix).
5. Re-open FB-92 and re-scope unit-26 (or a successor) to actually perform the rewrite.
6. After fix: `grep -En 'opacity-60' revisit-unit-list.html` → 0 hits.

**WCAG refs:** 1.4.3 Contrast (Minimum); 1.4.11 Non-Text Contrast.
