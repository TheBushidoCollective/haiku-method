---
title: >-
  feedback-inline-desktop/mobile + annotation-popover-states still carry
  text-[10px] after unit-11 claimed zero
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:58:09Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

Unit-11 `contrast-and-type-audit.md §3` "Post-sweep counts per artifact" table claims `text-[10px]: 0` for every one of the seven input artifacts. Spot-check against the checked-in files contradicts that claim:

```
grep -cE 'text-\[10px\]' stages/design/artifacts/feedback-inline-desktop.html   → 1
grep -cE 'text-\[10px\]' stages/design/artifacts/feedback-inline-mobile.html    → 1
grep -cE 'text-\[10px\]' stages/design/artifacts/feedback-card-states.html      → 14  (see FB-69)
grep -cE 'text-\[10px\]' stages/design/artifacts/annotation-popover-states.html → 4
```

**Specific sites:**

- `feedback-inline-desktop.html:375` — `<span class="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 …">agent · 2</span>` — a subscribe-chip / count-badge in the header.
- `feedback-inline-mobile.html` (same "agent · N" chip).
- `annotation-popover-states.html:380` — `<p class="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">New feedback @ …</p>`
- `annotation-popover-states.html:389` — `<p id="disabled-hint" class="text-[10px] text-stone-500 dark:text-stone-400 mb-2">Body is required.</p>` — this is **the accessible hint text** referenced by `aria-describedby`, so SR users will hear it but sighted users with mild visual impairment will not be able to read the matching visual.
- `annotation-popover-states.html:391, 394` — Cancel / Create buttons at 10px.

**Pattern:** the audit §3 verification loop was "trusted" rather than run. The grep one-liner printed as the verification script genuinely returns non-zero; it was not re-run before the unit was marked complete.

**Fix:** Every `text-[10px]` in the seven input artifacts must be promoted per the unit-11 §3 rule:
- Load-bearing body / button text → `text-xs` (12px)
- Uppercase label text → `text-[11px] font-semibold` (the unit-11 exception) or `text-xs font-bold`
- Purely decorative count-badges → either `text-xs font-bold` in a compact chip or hidden from the visible tree with `aria-hidden="true"` and the count included in the containing button's `aria-label`.

Re-run the §3 verification command AFTER the fix and update the §3 table with the live count (not the claimed count).
