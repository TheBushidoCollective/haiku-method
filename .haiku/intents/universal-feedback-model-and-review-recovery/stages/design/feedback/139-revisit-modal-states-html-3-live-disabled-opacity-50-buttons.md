---
title: >-
  revisit-modal-states.html 3 live disabled opacity-50 buttons ship despite
  FB-108 closure — 1.4.3 FAIL
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T17:50:57Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

`revisit-modal-states.html` still renders three disabled buttons using the banned `opacity-50` pattern that `contrast-and-type-audit.md §4 Bolt-4` and FB-108 both claim were remediated. The prose was updated but the rendered markup was not.

**Live violations (grep verified 2026-04-20):**

- `revisit-modal-states.html:100` — `<button class="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 text-white opacity-50 cursor-not-allowed" disabled>Confirm &amp; Revisit</button>`
  - `bg-amber-600` (#d97706) `text-white` α-composited at 0.5 over `bg-white` → ≈ 2.3:1 — FAIL WCAG 1.4.3 (≥ 4.5:1 body text).
  - Audit §4 Bolt-4 row 1 claims this was rewritten to `bg-amber-300 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 cursor-not-allowed` + `aria-disabled="true"` (5.30:1 / 8.15:1). It was not.
- `revisit-modal-states.html:155` — `<button class="px-3 py-1.5 text-xs font-semibold rounded-md border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 opacity-50 cursor-not-allowed" disabled>Cancel</button>`
  - `text-stone-700` × 0.5 α over white ≈ 3.2:1 — FAIL body text.
  - Audit §4 Bolt-4 row 2 claims the two disabled Cancel buttons were rewritten to `bg-stone-100 text-stone-600 border border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500 cursor-not-allowed` + `aria-disabled="true"` (6.85:1 / 10.2:1). Neither site was rewritten.
- `revisit-modal-states.html:552` — same banned pattern for the second Cancel button.

**Also violating the `aria-disabled="true"` paired-with-`disabled` contract (audit §4 QG3):**

- Lines 100, 155, 552 carry native `disabled` with no `aria-disabled="true"`.
- Line ~540 (the "Revisiting…" loading-state button with `aria-busy="true" disabled`) also lacks `aria-disabled="true"`. Python3 aria-disabled walker returns 7 violations total across the artifacts; 4 of them are in this file.

**Also problematic — reference prose on line 101:**

- `<p class="text-xs text-stone-500 dark:text-stone-400 font-mono">disabled:opacity-50</p>` canonicalizes the banned pattern in the artifact's own reference text right next to the rendered violation. FB-108 claimed this was rewritten by unit-27; the rendered button it describes still uses the banned tokens, so any dev copy-pasting this spec into implementation carries the failure forward.

**Fix required:**

1. Replace the three `opacity-50 cursor-not-allowed` strings with canonical primary-amber (`bg-amber-300 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 cursor-not-allowed`) and secondary (`bg-stone-100 text-stone-600 border border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500 cursor-not-allowed`) pairs per audit §4 Bolt-4.
2. Add `aria-disabled="true"` alongside every native `disabled` in the file (lines 100, 155, 540-area, 552).
3. Rewrite reference strip prose at 101/156 to cite the canonical token pair, not `disabled:opacity-50`.
4. After fix, verify `grep -En 'opacity-50' revisit-modal-states.html | grep -v backdrop-blur | grep -v 'black/50'` returns 0 hits and Python aria-disabled walker returns 0 for this file.

**WCAG refs:** 1.4.3 Contrast (Minimum); 1.4.11 Non-Text Contrast; 4.1.2 Name, Role, Value.

**Spec-drift impact:** This is a gate-failure pattern — audit says PASS, artifact ships FAIL, FB-108 was closed by unit-27 prose-only. Anyone reading the artifact for dev handoff will ship the contrast failure into production.
