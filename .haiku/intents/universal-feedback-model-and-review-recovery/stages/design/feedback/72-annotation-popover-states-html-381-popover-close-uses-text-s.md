---
title: >-
  annotation-popover-states.html:381 popover-close ✕ uses text-stone-400 on
  white — 2.52:1, fails 1.4.11 non-text contrast
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:56:28Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

The popover close button uses `text-stone-400` (`#a8a29e`) on the white popover surface — an icon-only glyph at 2.52:1 against the background. WCAG 1.4.11 Non-text Contrast requires ≥ 3:1 for UI components; the ✕ glyph IS the only affordance conveying "close this popover" until hover.

**Location:** `stages/design/artifacts/annotation-popover-states.html:381`
```html
<button aria-label="Close popover" class="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 …">&times;</button>
```

**Issues:**
1. Default state (before hover) is `text-stone-400` on the popover's white/stone-50 background: ratio **2.52:1** against white, **2.49:1** against stone-50 — fails 1.4.11.
2. Unit-11 §1 "Ban list" explicitly forbids `text-stone-400` on white / stone-50 / stone-100 backgrounds. This line is a direct violation of the ban the unit added to `DESIGN-TOKENS.md §1.1a`.
3. The dark-mode hover color (`dark:hover:text-stone-200`) is specified but there is no `dark:` non-hover color, so dark mode inherits the light-mode `text-stone-400` which against stone-900 (6.93:1) happens to pass — but the markup still leaks the banned light-mode class.

**Fix:** Replace with `text-stone-600 hover:text-stone-800 dark:text-stone-300 dark:hover:text-stone-100` (7.02:1 light / 12.6:1 dark, AAA). Keep the 44×44 hit-area treatment already in place via `.pin::before` elsewhere — the popover close needs the same treatment or explicit `p-2` padding.
