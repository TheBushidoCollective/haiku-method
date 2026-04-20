---
title: >-
  agent-feedback-toggle-spec.html uses text-[10px] + text-gray-400 on white —
  2.84:1 body-text fail
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:57:33Z'
iteration: 3
visit: 3
source_ref: null
closed_by: unit-21-stagewide-contrast-and-opacity-sweep
---

The agent-feedback-toggle spec artifact uses the banned `text-[10px]` type size combined with `text-gray-400` foreground on white in light mode — a stacked failure of unit-11 §1 (contrast) and §3 (type scale).

**Light-mode failures (stone/gray-400 on white = 2.84:1):**

- `L89`: `<p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Default (off)</p>` — `text-gray-400` on white = **2.84:1**, fails 1.4.3 AA body (4.5:1 required). `text-[10px]` also violates the type-size ban per unit-11 §3.
- `L107`: same pattern for "Checked (on)" label.
- `L125`: same pattern for "Focus (keyboard)" label.
- `L143`: same pattern for "Error state" label (if present — verify by scrolling).
- `L553` in `keyboard-shortcut-map.html`: `<p id="req-mod-help" class="text-[10px] text-stone-400 dark:text-stone-500 pl-5">…</p>` — `text-stone-400` on white is 2.52:1, same ban violation; this text is also the help copy for the "Require Alt for single-key shortcuts" setting, which is exactly the copy screen-reader users need to read.

**Light + dark variant-label failures (repeated across the artifact):**

- `L102`, `L120`: `<p class="text-[10px] text-gray-500 dark:text-gray-500 mt-2">aria-checked="false"; thumb left; track gray-300</p>` — meta-info body copy at 10px. Even though `text-gray-500` on white is 4.83:1 (passes), the 10px type size is banned outright per unit-11 §3.

**Why the audit missed this:**
The unit-11 post-sweep verification only grepped the 7 "input" artifacts listed in the unit frontmatter. `agent-feedback-toggle-spec.html` and `keyboard-shortcut-map.html` are **not** in that list, so the audit's grep loop never touched them. But they're still design stage artifacts that will be referenced by dev. The ban should apply stage-wide, not just to a curated subset.

**Fix:**
1. Promote every `text-[10px]` body / label to `text-xs` (12px) or `text-[11px] font-semibold` (the unit-11 exception).
2. Replace `text-gray-400 dark:text-gray-500` with `text-gray-600 dark:text-gray-400` (7.56:1 light / 6.99:1 dark, AAA both modes).
3. Extend the unit-11 / unit-17 verification greps to cover **every** `.html` file under `stages/design/artifacts/`, not just the 7 inputs.
