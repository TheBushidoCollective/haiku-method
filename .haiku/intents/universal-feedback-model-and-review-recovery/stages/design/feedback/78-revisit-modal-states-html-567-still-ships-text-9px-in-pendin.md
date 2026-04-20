---
title: >-
  revisit-modal-states.html:567 still ships text-[9px] in pending-feedback list
  — hard-banned per unit-11 §3
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:57:51Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

Unit-11 `contrast-and-type-audit.md §3` places `text-[9px]` on the absolute ban list: *"`text-[10px]` and `text-[9px]` banned outright for user-facing info."* The verification command in §3 is explicitly listed as checking `revisit-modal-spec` (which passes) but the companion states artifact was not grepped.

**Location:** `stages/design/artifacts/revisit-modal-states.html:567`
```html
<li class="flex items-center gap-2 text-xs">
  <span class="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold
               bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Design</span>
  …
</li>
```

**Why this violates the ban:**
1. 9px type violates WCAG 1.4.4 Resize Text — at 200% zoom on a 1440×900 reviewer display this glyph is rendered at effectively 7px CSS pixel after sub-pixel rounding, frequently unreadable.
2. `text-amber-700` on `bg-amber-100` at 9px: the contrast math (4.52:1) only just passes for large text, but "large" under WCAG is ≥ 18.66px / 14pt bold. At 9px, the 4.5:1 AA minimum applies and actually passes — but the point is the **size**, not the contrast.
3. The chip is a "stage badge" conveying stage ownership — it's load-bearing, not decorative.

**Spread of the violation:** verify whether the stage-chip shortcut is copied elsewhere in the file. Likely present in other pending-feedback list rows below line 567 as well.

**Fix:** Promote to `text-[10px]` AND go further to `text-xs font-semibold`, OR redesign the chip to use `text-[11px] font-semibold` (the only permitted sub-xs size per the unit-11 exception). Extend the unit-11 §3 grep to cover `revisit-modal-states.html`:
```
grep -cE 'text-\[9px\]|text-\[10px\]' stages/design/artifacts/revisit-modal-states.html
→ must be 0
```
Currently returns ≥ 1.
