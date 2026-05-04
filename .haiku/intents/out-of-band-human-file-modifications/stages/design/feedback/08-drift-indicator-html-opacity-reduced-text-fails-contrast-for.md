---
title: >-
  drift-indicator.html: opacity-reduced text fails contrast for .drift-body and
  entry timestamps
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-28T20:26:04Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-08:bolt-3'
bolt: 3
triaged_at: '2026-04-28T20:26:04Z'
resolution: null
replies: []
---

## Finding

Two sets of text in `drift-indicator.html` apply opacity reductions that undercut the contrast ratios claimed in `SPA-UI-SPECS.md §4.4`.

**`.drift-body` (lines 193–196):**
```css
.drift-body {
  color: var(--color-drift-detected-fg);
  opacity: 0.85;
}
```
`--color-drift-detected-fg` is `oklch(52% 0.18 80)` (amber-700 family). The spec table at §4.4 reports ~5.2:1 for this token against `--color-drift-detected-bg` at full opacity, which passes 4.5:1 for normal text. At 85% opacity the effective foreground blends toward the amber-50 background, reducing the real contrast. The spec table does not account for this opacity reduction. The actual rendered ratio drops below 5.2:1 and needs independent verification against the 4.5:1 threshold.

**`.drift-entry-age` and `.drift-entry-event` (lines 282–291) + inline tablet/mobile styles (lines 582, 590, 644, 655):**
```css
.drift-entry-event { color: var(--color-drift-detected-fg); opacity: 0.7; }
.drift-entry-age   { color: var(--color-drift-detected-fg); opacity: 0.7; }
```
At 70% opacity the amber-700-family foreground blends substantially toward the amber-50 background. These are also rendered at `font-size: 10px` — well below the 18px (or 14px bold) "large text" threshold — making 4.5:1 the applicable minimum. The effective contrast at 0.7 opacity is likely to fall below 4.5:1. The spec table does not include this pair.

The `SPA-UI-SPECS.md §4.4` contrast table lists the token-pair ratio at full opacity only. It does not note that both of these text elements reduce opacity, so the implementation note that "exact ratios must be verified" is insufficient — the table itself is misleading because it does not flag the opacity reduction.

## Required fix

1. Either remove the opacity reduction and rely on the token's intrinsic lightness for visual hierarchy (e.g. a lighter `--color-drift-detected-fg-muted` token), or add a note to `SPA-UI-SPECS.md §4.4` explicitly covering the opacity-reduced states with verified contrast figures.
2. Verify the effective contrast of `.drift-body` at 0.85 opacity and `.drift-entry-event`/`.drift-entry-age` at 0.70 opacity against `--color-drift-detected-bg`. If either fails 4.5:1, the opacity must be raised or the foreground token darkened.

## File:line references

- `wireframes/drift-indicator.html:195` — `.drift-body { opacity: 0.85 }`
- `wireframes/drift-indicator.html:283` — `.drift-entry-event { opacity: 0.7 }`
- `wireframes/drift-indicator.html:290` — `.drift-entry-age { opacity: 0.7 }`
- `wireframes/drift-indicator.html:582, 590, 644, 655` — inline tablet/mobile opacity:0.7 on timestamps
- `artifacts/SPA-UI-SPECS.md:405` — contrast table omits opacity-reduction states
