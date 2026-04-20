---
title: >-
  feedback-card-states.html error-card uses banned text-[10px] for body copy,
  buttons, and labels — 14 occurrences
status: rejected
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:55:58Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

Unit-11 `contrast-and-type-audit.md §3` declares `text-[10px]` banned outright for user-facing information, and the audit's §3 table claims 0 occurrences in `feedback-card-states.html`. The file actually ships 14 `text-[10px]` usages, including load-bearing body copy and actionable buttons — WCAG 1.4.4 (Resize Text) and 1.4.3 (AA minimum readability) violation.

**Locations in `stages/design/artifacts/feedback-card-states.html`:**

- L491: `<p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Light · card error …</p>` — bold uppercase label (this is the only one arguably defensible per the `text-[11px]+font-semibold` exception, but the audit ban was explicit on `text-[10px]`, and the exception is documented only for 11px).
- L495, 496, 498: origin badge / status badge / "rejected" chip — `text-[10px]` on critical status text.
- **L503** `<p id="err-body-light" class="text-[10px] text-red-700 mt-1">Close rejected — …</p>` — **this is the entire error-message body copy at 10px**. Users must read this to understand why the action failed. Fails WCAG 1.4.4 at 200% zoom and the unit-11 ban.
- L505, L506: "Dismiss" / "Learn why" buttons — `text-[10px] font-semibold` on actionable buttons.
- L513, L517, L518, L520, L525, L527, L528: same pattern repeated for the dark-mode error card.

**Why the audit missed this:** the `contrast-and-type-audit.md §3` post-sweep table measured only the rows "feedback-inline-desktop / feedback-inline-mobile / feedback-card-states / …" with a grep that doesn't reflect these lines. Spot-check:
```
grep -cE 'text-\[10px\]' stages/design/artifacts/feedback-card-states.html
→ 14
```
The audit's own verification command returns 14, not 0.

**Fix:** Promote the error-card body copy and action buttons to `text-xs` (12px). For the uppercase labels, either move to `text-[11px] font-semibold` per the audit's own allowed exception, or to `text-xs`. Re-run the grep after the sweep and reconcile the §3 table with reality.

---

**Rejection reason:** Stale: `grep -c 'text-\[10px\]' feedback-card-states.html` returns 0 after unit-16 sweep merged. Reviewer scanned the pre-merge version.
