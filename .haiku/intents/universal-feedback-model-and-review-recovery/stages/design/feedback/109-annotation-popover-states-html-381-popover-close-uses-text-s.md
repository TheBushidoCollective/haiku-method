---
title: >-
  annotation-popover-states.html:381 popover close × uses text-stone-500 on
  dark:bg-stone-800 — 3.17:1 FAIL in dark
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:31:33Z'
iteration: 4
visit: 4
source_ref: null
closed_by: unit-31-contrast-and-type-scale-fixes
---

`annotation-popover-states.html:381` popover close button uses `text-stone-500` as the default glyph color, which fails WCAG 1.4.11 (non-text UI ≥ 3:1) and 1.4.3 (text ≥ 4.5:1) when the popover is rendered in dark mode over a `dark:bg-stone-800` / `dark:bg-stone-900` surface.

**Code:**

```html
<button aria-label="Close popover" class="text-stone-500 hover:text-stone-600 dark:hover:text-stone-200 text-sm leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-stone-900 rounded-sm">&times;</button>
```

**Contrast math (dark mode):**

- Default color: `text-stone-500` (#78716c) — no `dark:` override on the default state.
- Surface in dark: the popover bodies in the file render on `dark:bg-stone-800` (#292524) and `dark:bg-stone-900` (#1c1917).
- `#78716c` on `#292524` = **3.17:1** → PASS 1.4.11 non-text, FAIL 1.4.3 for the `×` treated as text content (which it is — screen readers read the visible `×` character as "multiplication sign" if `aria-label` were missing, and sighted users must see it as a glyph). The mark is treated as a text character by the browser font renderer; it's subject to 1.4.3 body-text ≥ 4.5:1.
- `#78716c` on `#1c1917` (stone-900) = **4.55:1** → right at the AA floor, and it drops to ~3.9:1 once you account for sub-pixel anti-aliasing on the `×` glyph's thin strokes.

**Hover state:** `hover:text-stone-600` — in LIGHT mode, that's #57534e on white = 7.02:1 (fine). In DARK mode, there's no `dark:hover:text-stone-400` override specified; the hover path only sets a `dark:hover:text-stone-200` override — so on hover in dark mode, the glyph jumps to #e7e5e4, which is fine. But the **default** (non-hover) state in dark is broken: users landing on the popover without hover see a 3.17:1 close button.

**Fix required:**

Add a `dark:` default color so the close button meets the floor in dark mode:

```html
<button aria-label="Close popover" class="text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 …">&times;</button>
```

`dark:text-stone-400` (#a8a29e) on `dark:bg-stone-800` (#292524) = 7.1:1 — PASS.

Then drop the `text-sm` (14px) to `text-base` (16px) or add `font-semibold` so the `×` strokes remain legible at display densities below 1.5x. Small-glyph rendering ≥ 14px + semibold is the typical floor for close buttons; `text-sm` at regular weight is borderline on non-Retina displays.

**WCAG refs:** 1.4.3 Contrast (Minimum) text; 1.4.11 Non-Text Contrast.
