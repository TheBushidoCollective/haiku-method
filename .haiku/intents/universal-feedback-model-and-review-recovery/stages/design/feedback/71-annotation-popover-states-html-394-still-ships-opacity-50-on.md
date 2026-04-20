---
title: >-
  annotation-popover-states.html:394 still ships opacity-50 on disabled "Create"
  button — composite text contrast ~2.6:1
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:56:13Z'
iteration: 3
visit: 3
source_ref: null
closed_by: unit-21-stagewide-contrast-and-opacity-sweep
---

Unit-11 `contrast-and-type-audit.md §2` declares "No `opacity-50` / `opacity-70` anywhere" as PASS in the summary table and lists `annotation-popover-states.html opacity-50/70: 0` in the bolt-2 verification. The file still contains one `opacity-50` on the exact pattern that was flagged in FB-13 / FB-19: a disabled button carrying `text-white opacity-50` (composite contrast < 3:1 for UI and < 4.5:1 for text).

**Location:** `stages/design/artifacts/annotation-popover-states.html:394`
```html
<button class="px-2.5 py-1 text-[10px] font-semibold rounded-md bg-teal-600 text-white opacity-50 cursor-not-allowed">Create</button>
```

**Failures, stacked on the same element:**
1. `opacity-50` on a text-carrying button — α-composited ratio ≈ 2.6:1, fails WCAG 1.4.3 (text AA) and 1.4.11 (non-text contrast).
2. `text-[10px]` — banned per unit-11 §3 and fails 1.4.4.
3. No `aria-disabled="true"` (native `disabled` attribute is also missing — this is an enabled button styled as disabled, which is worse: keyboard users can activate it even though it looks inert).

**Fix:** Replace with the DESIGN-TOKENS §4 disabled pair (`disabled:bg-teal-200 disabled:text-teal-800` or equivalent per the token table), add the native `disabled` attribute + `aria-disabled="true"`, and promote the label to `text-xs`. Then re-run `grep -c 'opacity-50' stages/design/artifacts/annotation-popover-states.html` and confirm the audit §2 table reflects the actual count (currently claims 0; actual is 1).
