---
title: >-
  annotation-popover-states.html:394 State 4b still ships bg-teal-600 text-white
  opacity-50 — FB-71 falsely closed
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T17:52:50Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

`annotation-popover-states.html` State 4b's disabled "Create" button at line 394 still carries the banned `bg-teal-600 text-white opacity-50 cursor-not-allowed` pattern. This directly contradicts `contrast-and-type-audit.md §4 Bolt-3` which claims this exact button was remediated, and FB-71 which was marked closed.

**Live violation (grep verified 2026-04-20):**

- `annotation-popover-states.html:394` — `<button ... class="px-2.5 py-1 text-xs font-semibold rounded-md bg-teal-600 text-white opacity-50 cursor-not-allowed">Create</button>`

**Contrast math:**

- `bg-teal-600` (#0d9488) `text-white` α-composited at 0.5 α over `bg-white` page:
  - Effective `bg` ≈ #86c9c3 (50% blend teal-600 + white).
  - `text-white` (#fff) on #86c9c3 → ratio ≈ 2.1:1 — FAIL AA body text (≥ 4.5:1) AND AA large text (≥ 3:1).
- Dark mode: teal-600 × 0.5 α over `bg-stone-900` → effective ≈ #0e4946 with `text-white` → ≈ 8.6:1 — passes in dark only, but component must pass AA in both modes.

**What the audit claims vs. reality:**

- `contrast-and-type-audit.md §1 row "annotation-popover-states.html · State 4b 'Create' (disabled)"` lists post-unit as `bg-stone-100 text-stone-600 border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500 cursor-not-allowed` (6.85:1 light / 10.2:1 dark; border 3.4:1 / 3.2:1) — PASS.
- `contrast-and-type-audit.md §4 Bolt-3 additions` has an entire paragraph devoted to "State 4b was a holdout. Replaced with: `bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-400 dark:border-stone-500 cursor-not-allowed`. Same button's font size was lifted from `text-[10px]` to `text-xs`."
- The file still ships `bg-teal-600 text-white opacity-50 cursor-not-allowed` verbatim. The rewrite never landed; only the prose recording the rewrite did.

**Also a missing aria-disabled attribute:**

- The button has `cursor-not-allowed` but no `disabled` attribute and no `aria-disabled="true"`. A keyboard user can tab to and activate this button even though the visual affordance says it's disabled. Audit §4 disabled-contract requires both `disabled` and `aria-disabled="true"` on statically-disabled buttons.

**Fix required:**

1. Rewrite line 394 to: `<button type="button" disabled aria-disabled="true" class="px-2.5 py-1 text-xs font-semibold rounded-md bg-stone-100 text-stone-600 border border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500 cursor-not-allowed">Create</button>`.
2. Re-open FB-71 and FB-95 (both called this line out and were marked closed without the fix landing). Scope a follow-up unit to run the verification grep as a stage quality gate.
3. After fix: `grep -En 'opacity-50' annotation-popover-states.html` → 0 hits.

**WCAG refs:** 1.4.3 Contrast (Minimum); 1.4.11 Non-Text Contrast; 4.1.2 Name, Role, Value.
