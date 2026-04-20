---
title: >-
  unit-31 gate (b) disjunction "text-base OR font-semibold" leaves the
  legibility choice unverified
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T15:31:09Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-31-contrast-and-type-scale-fixes.md
closed_by: null
bolt: 0
upstream_stage: null
---

File: `stages/design/units/unit-31-contrast-and-type-scale-fixes.md:42-50` (gate for annotation-popover close ✕, FB-109)

Gate text: "Size lifted from `text-sm` to `text-base` OR `font-semibold` added to preserve glyph legibility at sub-pixel densities."

The disjunction means the designer picks one path, but neither picks a measurable test. If the designer picks `text-base` and forgets to add it on one instance, the grep `grep -n 'text-sm' ...:381` may still return a hit — and no gate proves "at least one of {text-base, font-semibold} is present." FB-109 cites WCAG 1.4.3 AND 1.4.11; the size/weight change is to hit the ~14px+semibold floor for non-text glyph strokes on low-DPI displays. Without either change the fix is incomplete.

**Proposed fix (diff-level):**

Convert to an explicit either-or grep gate that fails if neither landed:

```yaml
- >-
  `annotation-popover-states.html:381` close button has at least one of:
  `text-base` size token OR `font-semibold` weight token, in addition to
  the new `dark:text-stone-400` color pair. Grep proof (must return ≥ 1):
  `grep -nE 'aria-label="Close popover"[^>]*(text-base|font-semibold)'
  stages/design/artifacts/annotation-popover-states.html`. The
  `text-sm`-only / no-weight path is explicitly forbidden — if the grep
  returns 0 on the close-button line, the gate fails.
```

This pins the disjunction to an executable test and keeps the designer's freedom to pick which of the two satisfies it.
