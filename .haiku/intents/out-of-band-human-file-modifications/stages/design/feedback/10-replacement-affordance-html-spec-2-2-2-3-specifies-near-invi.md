---
title: >-
  replacement-affordance.html: spec §2.2/2.3 specifies near-invisible -bg border
  tokens; wireframe overrides to -fg
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-28T20:31:59Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-10:bolt-3'
bolt: 3
triaged_at: '2026-04-28T20:31:59Z'
resolution: null
replies: []
---

## Finding

`SPA-UI-SPECS.md §2.2` and the border column in the §2.3 table both specify that card left-border accents use the **`-bg`** token variants:

> `--color-drift-detected-bg` | Card left-border accent when drift is detected, awaiting classification

However, `wireframes/replacement-affordance.html` first sets the `-bg` values (lines 138–149 with an inline comment acknowledging this) and then immediately overrides to the `-fg` values:

```css
/* §2.2 -bg assignment (lines 138-149) */
.artifact-card--drift-detected  { border-left: 4px solid var(--color-drift-detected-bg); }

/* Override to -fg (lines 152-155) */
.artifact-card--drift-detected  { border-left-color: var(--color-drift-detected-fg); }
```

The wireframe's own spec notes at the bottom (line 911) say: *"All drift-state borders use `var(--color-drift-{state}-fg)`"* — directly contradicting §2.2.

This is an accessibility issue, not just a terminology conflict. The `-bg` tokens are near-white (`oklch(97% 0.04 80)` for amber-50). A 4px left border in a near-white amber color on a white card surface would have less than 1.1:1 contrast against the card background — failing the 3:1 threshold for UI components (WCAG 1.4.11). The wireframe "fixes" this by overriding to `-fg`, but the spec text still says `-bg`. An implementer reading §2.2 and §2.3 first would ship invisible borders.

The spec must be corrected to match what the wireframe renders (use `-fg` tokens for borders) so the implementation receives unambiguous guidance that meets 3:1 for UI components.

## Required fix

Update `SPA-UI-SPECS.md §2.2` (the token table) and §2.3 (the border-column of the non-color signal table) to specify `-fg` tokens for card left-borders, matching the wireframe's actual rendering. The `-bg` designation in both tables is incorrect for the border use case and would produce invisible borders.

## File:line references

- `wireframes/replacement-affordance.html:139` — comment says "uses -bg per spec (§2.2)" then line 152 overrides to `-fg`
- `wireframes/replacement-affordance.html:911` (spec notes) — contradicts §2.2 by asserting `-fg`
- `artifacts/SPA-UI-SPECS.md:147–150` — §2.2 table: specifies `-bg` tokens for card borders
- `artifacts/SPA-UI-SPECS.md:165–169` — §2.3 table: border column shows `-bg` tokens
