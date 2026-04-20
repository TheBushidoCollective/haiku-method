---
title: >-
  text-[11px] without font-semibold/bold across 5 artifacts — violates §3
  type-scale floor (WCAG 1.4.4)
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:30:09Z'
iteration: 4
visit: 4
source_ref: null
closed_by: unit-31-contrast-and-type-scale-fixes
---

`contrast-and-type-audit.md §3 Type Scale` states:

> "`text-[11px]` permitted only when paired with `font-semibold` (compensates for the size reduction). `text-[10px]` and `text-[9px]` banned outright for user-facing info."

The grep proof in §3 Verification claims "Remaining `text-[11px]` instances are ALL paired with `font-semibold` or `font-bold` (verified by spot-check of each match)." That is false for the following live instances.

**Live violations (grep verified 2026-04-19):**

- `review-ui-mockup.html:43` — `<span class="text-[11px] font-mono text-stone-500 dark:text-stone-500">session <span id="session-id">r_8f2c91a</span></span>` (no semibold/bold; `font-mono` is not a weight)
- `review-ui-mockup.html:146` — `<span class="mt-2 text-[11px] font-medium text-stone-500 dark:text-stone-400 leading-none">Operations</span>` (`font-medium` is 500, not the required semibold/bold 600+)
- `review-ui-mockup.html:163` — same pattern for "Security" label
- `review-ui-mockup.html:802` — `<p class="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-snug ml-7 break-words">${f.body}</p>` (no weight at all; plus text-stone-500 on potentially-white bg is already marginal)
- `review-ui-mockup.html:1019` — `<p class="text-[11px] font-mono text-stone-500 dark:text-stone-500 truncate mt-0.5">${u.name}</p>` (font-mono only)
- `review-ui-mockup.html:1285` — `<span class="flex-1 min-w-0 text-[11px] text-stone-700 dark:text-stone-300 truncate">${escHtml(x.f.title)}</span>` (no weight)
- `review-ui-mockup.html:1496, 1532, 1568` — `<button … class="w-full px-3 py-1.5 text-[11px] font-medium text-teal-600 dark:text-teal-400 hover:underline">+ ${more} more…</button>` (font-medium, not semibold)
- `keyboard-shortcut-map.html:546` — `<footer class="… text-[11px] text-stone-500 dark:text-stone-400 space-y-2">` (no weight)
- `keyboard-shortcut-map.html:635` — `<footer class="text-[11px] text-stone-500 dark:text-stone-500 pt-6 …">` (no weight)
- `feedback-lifecycle-transitions.html:226` — `<p class="mt-3 text-[11px] text-stone-500 dark:text-stone-400 italic">` (italic 11px with no weight bump — italic *reduces* legibility further)
- `focus-ring-spec.html:108` — `<code class="text-[11px] text-stone-700 dark:text-stone-300 break-all">` (code content, still user-facing, no weight)
- `review-package-structure.html:545, 666, 697, 725, 767, 805, 839, 870` — eight `<div class="code-block text-[11px]">` instances (code blocks with no weight)
- `review-package-structure.html:802` — `<p class="text-[11px] text-stone-500 dark:text-stone-400 mb-3">` (no weight)

**Why the rule exists:** At 11px, glyph strokes are already close to the legibility threshold for average vision. The `font-semibold` compensation adds stroke weight that keeps edges rendered across AA monitors, high-DPI displays, and the Zoom 200% assistive-tech resize path required by WCAG 1.4.4. Medium (500) weight is NOT enough — the difference is measurable in rasterizer output at 11px.

**Fix required (pick one per instance):**

1. Lift to `text-xs` (12px) — removes the 11px-specific weight requirement entirely. This is the preferred fix for user-facing copy like the "Operations" / "Security" stage labels, the feedback-body preview at `:802`, the code blocks in review-package-structure, and the `+ N more` buttons.
2. Change `font-medium` → `font-semibold` where the 11px size is load-bearing (tight metrics, monospace code labels) and can't be lifted to `text-xs` without breaking the layout.

**WCAG refs:** 1.4.4 Resize Text (Level AA).
