---
title: >-
  assessor-summary-card.html:78 text-stone-600 on bg-stone-900 at 2.56:1 — 1.4.3
  FAIL
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:30:31Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

`assessor-summary-card.html` is forced to dark mode (`<html lang="en" class="dark">` at L2), and the "already-closed (prior visit)" bullet uses `text-stone-600` on the rendered `bg-stone-900` surface — FAILS WCAG 1.4.3 body text.

**Live violations (grep verified 2026-04-19):**

- `assessor-summary-card.html:78` —
  ```html
  <li class="flex items-start gap-2">
    <span class="mt-1 w-1.5 h-1.5 rounded-full bg-stone-600 shrink-0"></span>
    <span class="text-stone-500">
      <span class="font-mono text-xs text-stone-600">FB-04</span> · already closed (prior visit)
    </span>
  </li>
  ```
  - The outer span is `text-stone-500` (#78716c) on `bg-stone-900` (#1c1917) = **4.55:1** — at the floor.
  - The inner `font-mono text-xs text-stone-600` (#57534e) on the same `bg-stone-900` = **2.56:1** — FAIL.

- `assessor-summary-card.html:73` — the whole `<ul class="text-xs text-stone-400 space-y-1 …">` carries `text-stone-400` as the default color for per-item bullets. On the dark card surface this is OK (≈ 8.7:1 on `bg-stone-900`) but the ban list from `contrast-and-type-audit.md §1.1a` forbids standalone `text-stone-400` without a `dark:` prefix; on a light-mode render this would be a failure. Since this artifact is forced-dark via `class="dark"` on `<html>`, it renders OK today — but the pattern is still dangerous if the `class="dark"` is ever removed (e.g. if this component is embedded into a light-mode parent).

- `assessor-summary-card.html:232` — `<div class="text-xs text-stone-400">subagent did not return within 120s. feedback state not mutated. FSM failing closed.</div>` — sits inside a `bg-stone-900` card. Same story: 8.7:1 passes in the forced-dark render, but the class is `text-stone-400` (not `dark:text-stone-400`), so it will fail if the page ever renders without the hard-coded `class="dark"`.

**Fix required:**

1. Line 78: raise the "already closed" span from `text-stone-500` + inner `text-stone-600` to `text-stone-400` outer + `text-stone-300` inner on dark surfaces (or drop the card-override and use `text-stone-600 dark:text-stone-300` throughout, which is the canonical metadata pair from `contrast-and-type-audit.md §1`).
2. Lines 73, 160, 232: swap bare `text-stone-400` to the canonical pair `text-stone-600 dark:text-stone-300` so the component is safe to render in either color scheme.

**WCAG refs:** 1.4.3 Contrast (Minimum).
