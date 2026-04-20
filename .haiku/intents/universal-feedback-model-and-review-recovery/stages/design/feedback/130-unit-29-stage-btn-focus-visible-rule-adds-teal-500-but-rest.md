---
title: >-
  unit-29 .stage-btn focus-visible rule adds teal-500 but rest of stage uses
  teal-600 for focus rings
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:34:33Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-29-focus-visible-canonicalization-and-spec-clarity.md
closed_by: null
bolt: 0
upstream_stage: null
---

`stages/design/units/unit-29-focus-visible-canonicalization-and-spec-clarity.md` quality gate 3 (line 56-72) adds a focus-visible treatment to `.stage-btn`:

> "Add: `.stage-btn:focus-visible .stage-icon { outline: 3px solid rgb(20 184 166); outline-offset: 3px; }`"

The RGB value `rgb(20 184 166)` is Tailwind `teal-500`. But the canonical focus ring stage-wide (per quality gate 2, line 49-55) uses `focus-visible:ring-teal-500` on inputs, and the canonical code sample in quality gate 4 (line 74-88) also cites `focus-visible:ring-teal-500`.

Meanwhile FB-91 (unit-28 quality gate 5, line 78-91) canonicalizes tab active color as `border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400` — teal-600 for active selection.

So the palette is: teal-500 = focus ring, teal-600 = active selection, teal-400 = dark-mode variants. This is internally consistent BUT unit-29 hard-codes `rgb(20 184 166)` and `rgb(45 212 191)` (teal-500 / teal-400) as inline CSS rather than using Tailwind utility classes. If the canonical teal scale is ever tweaked in DESIGN-TOKENS.md, these raw RGB values will silently drift.

Proposed fix: either (a) cite the DESIGN-TOKENS.md §1.1 teal row explicitly in a comment above the rule so any future palette migration knows to update these inline values; or (b) convert to CSS variable references if DESIGN-TOKENS.md §1.1 has a `--color-teal-500` / `--color-teal-400` CSS var:

```css
/* teal-500 / teal-400 per DESIGN-TOKENS.md §1.1 */
.stage-btn:focus-visible .stage-icon {
  outline: 3px solid rgb(20 184 166); /* teal-500 */
  outline-offset: 3px;
}
html.dark .stage-btn:focus-visible .stage-icon {
  outline-color: rgb(45 212 191); /* teal-400 */
}
```

This matches the unit's existing inline-comment convention and flags the tokens as palette-dependent for future audits. The FB-85/FB-88 ban-list precedent (magic numbers must be replaced with named tokens) argues for (b) if a CSS var exists; otherwise (a) is the minimum.
