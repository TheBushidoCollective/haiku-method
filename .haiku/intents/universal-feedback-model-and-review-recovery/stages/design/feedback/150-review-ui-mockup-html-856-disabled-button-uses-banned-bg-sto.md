---
title: >-
  review-ui-mockup.html:856 disabled button uses banned
  bg-stone-100+text-stone-500 — 1.4.3 + 4.1.2 FAIL
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T17:53:32Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

`review-ui-mockup.html` line 856 renders a dynamic disabled button whenever a non-current stage has nothing pending and nothing typed:

```js
<button disabled class="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-500 cursor-not-allowed">Add feedback above to enable</button>
```

This ships three distinct accessibility failures:

**Issue 1 — Banned token pair (WCAG 1.4.3 Contrast):**

- `text-stone-500` (#78716c) on `bg-stone-100` (#f5f5f4) = **4.40:1** — FAIL AA body-text (≥ 4.5:1).
- This is the exact pair on the ban list in `contrast-and-type-audit.md §1 Ban list` — "stone-500 on stone-100 → 4.40:1 — fails AA body text."
- Dark: `text-stone-500` on `bg-stone-800` (#292524) = **3.49:1** — FAIL AA body-text.
- Remediation per audit: use `text-stone-600` (light, 6.85:1) or `text-stone-300` (dark, 10.2:1).

**Issue 2 — `disabled` without `aria-disabled="true"` (WCAG 4.1.2 Name, Role, Value):**

- The button carries native `disabled` but no `aria-disabled="true"`. This contradicts audit §4 QG3 and the stage-wide `aria-disabled` contract in DESIGN-BRIEF §6. Some AT (particularly older NVDA + Firefox combinations) don't announce `disabled` reliably without `aria-disabled`.
- Python3 aria-disabled walker flags this as a violation.

**Issue 3 — No focus-visible ring despite being dynamically inserted:**

- The button has no `focus:` or `focus-visible:` classes. If it is momentarily focusable before the `disabled` attribute applies, the user gets no focus indication. Even if `disabled` prevents activation, browsers behave inconsistently about whether a disabled button can receive focus (Safari: yes in some configurations; Chrome: no). Belt-and-suspenders pair: `disabled` + `aria-disabled="true"` + a visible focus ring so behavior is consistent.

**Fix required:**

1. Rewrite line 856 to use the canonical secondary-disabled token pair:
```js
<button disabled aria-disabled="true" class="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-400 dark:border-stone-500 cursor-not-allowed focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 outline-none">Add feedback above to enable</button>
```
2. Add the same pattern to line 844-852's other dynamic button branches (`onRequestChanges`, `onApprove`) — they use `focus:ring-2` rather than `focus-visible:`. Switch to `focus-visible:` so keyboard-only users get the ring while pointer users don't see it.
3. After fix: grep `bg-stone-100.*text-stone-500\|text-stone-500.*bg-stone-100` review-ui-mockup.html → 0 hits; aria-disabled walker returns 0.

**WCAG refs:** 1.4.3 Contrast (Minimum); 4.1.2 Name, Role, Value; 2.4.7 Focus Visible.
