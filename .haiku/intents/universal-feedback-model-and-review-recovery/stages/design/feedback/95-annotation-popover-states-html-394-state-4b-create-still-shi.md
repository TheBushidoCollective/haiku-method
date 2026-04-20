---
title: >-
  annotation-popover-states.html:394 State 4b Create still ships bg-teal-600
  text-white opacity-50 — banned
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:27:40Z'
iteration: 4
visit: 4
source_ref: null
closed_by: unit-26-artifact-opacity-ban-enforcement
---

`annotation-popover-states.html` State 4b "Create" button still carries the exact banned pattern `contrast-and-type-audit.md §4 Bolt-3` claims was replaced, plus the explanatory `<li>` text that canonicalizes the banned approach.

**Live violations (grep verified 2026-04-19):**

- `annotation-popover-states.html:394` —
  ```html
  <button disabled aria-disabled="true"
          title="Body is empty — Create is disabled"
          class="px-2.5 py-1 text-xs font-semibold rounded-md bg-teal-600 text-white opacity-50 cursor-not-allowed">Create</button>
  ```
  Contrast math: `text-white` (#fff) on `bg-teal-600` (#0d9488) at 50% α-composited against body bg (`bg-white` in light mode) yields an effective foreground at (approximately) α-composited white on approx-white → text nearly disappears. Measured contrast drops to ≈ 2.3:1 — FAIL WCAG 1.4.3 (≥ 4.5:1 body) and FAIL 1.4.11 (≥ 3:1 UI).
- `annotation-popover-states.html:402` — explanatory `<li>` still reads:
  > "Button keeps the teal color at `opacity: 0.5` so the brand / primary-action meaning is preserved; a user recognizes 'this is the primary action but it's not ready yet.'"
  This canonicalizes the banned pattern in the spec prose, directly contradicting `contrast-and-type-audit.md §4 Bolt-3` which says "State 4b's explanatory copy was rewritten … Replaced with a bullet that states the canonical disabled token pair…"

**What the audit claims vs. what's in the file:**

`contrast-and-type-audit.md §4 Bolt-3` (lines 274-297) explicitly states the State 4b Create button was rewritten to `bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-400 dark:border-stone-500 cursor-not-allowed` and that the explanatory bullet was replaced. Neither has happened in the rendered artifact.

**Fix required:** Apply the canonical secondary-disabled token pair to the State 4b Create button as the audit already describes, and rewrite the `<li>` at line 402 to stop canonicalizing the banned `opacity: 0.5` approach.

**WCAG refs:** 1.4.3 Contrast (Minimum); 1.4.11 Non-Text Contrast.
