---
title: >-
  revisit-unit-list.html still ships opacity-60 on 9 locked cards +
  bg-stone-200/text-stone-500 pill — 1.4.3 FAIL
status: open
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:26:56Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

`revisit-unit-list.html` still renders the banned opacity-as-state pattern on nine `.locked-card` surfaces, directly contradicting the unit-11 / unit-18 repo-wide ban that `contrast-and-type-audit.md §6.3` claims was remediated.

**Live violations (grep verified 2026-04-19):**

- `revisit-unit-list.html:247` — `<div ... class="locked-card bg-white dark:bg-stone-900 ... opacity-60 transition-opacity outline-none">` (unit-01 card)
- `revisit-unit-list.html:259` — same pattern (unit-02 card)
- `revisit-unit-list.html:271` — same pattern (unit-03 card)
- `revisit-unit-list.html:283` — same pattern (unit-04 card)
- `revisit-unit-list.html:295` — same pattern (unit-05 card)
- `revisit-unit-list.html:307` — same pattern (unit-06 card)
- `revisit-unit-list.html:319` — same pattern (unit-07 card)
- `revisit-unit-list.html:345` — state-coverage reference tile "Default (locked, opacity 60%)"
- `revisit-unit-list.html:393` — state-coverage reference tile

The `<h3>` inside each of these cards uses `text-stone-700 dark:text-stone-400`. α-composited with `opacity: 0.6` on `bg-white`:

- Light: `text-stone-700` (#44403c) × 0.6 α over white drops the ratio below the WCAG 1.4.3 AA 4.5:1 floor for body text.
- Dark: `text-stone-400` (#a8a29e) × 0.6 α over `bg-stone-900` (#1c1917) — same failure mode.

**What contrast-and-type-audit.md §6.3 claims vs. what's in the file:**

The audit's bolt-3 remediation table (lines ~494-498) explicitly says these 7 locked cards were rewritten to `bg-stone-50 dark:bg-stone-900/60 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 shadow-sm p-4 outline-none` with `text-stone-600 dark:text-stone-300` titles and the stylesheet's `.locked-card:hover { opacity: 0.8 }` / `:focus-visible { opacity: 0.95 }` rules removed. None of that has happened in the rendered HTML. The audit is factually incorrect — the HTML still carries every banned pattern the audit claims to have removed.

**Also violates:**

- `revisit-unit-list.html:240` + `:398` — the `<span>` read-only pill uses `bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-400`. `text-stone-500` on `bg-stone-200` is 2.66:1 — FAIL for body text (WCAG 1.4.3 ≥ 4.5:1). This is exactly the QG2 banned-disabled-pattern grep target (`bg-stone-200 text-stone-500`), contradicting `contrast-and-type-audit.md §6.2` PASS claim.

**Fix required:** Actually apply the bolt-3 remediation that the audit claims was done — drop `opacity-60` from every `.locked-card`, swap the card bg/border tokens as described in §6.3, and raise the read-only pill text from `text-stone-500` to `text-stone-700`/`dark:text-stone-300`.

**WCAG refs:** 1.4.3 Contrast (Minimum); 1.4.11 Non-Text Contrast (read-only pill border + bg).
