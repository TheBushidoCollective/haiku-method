---
title: >-
  unit-30 anchor conversion lacks state-coverage matrix and collides with
  unit-28 on stage-progress-strip.html
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:33:55Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-30-native-activation-and-live-region-landmarks.md
closed_by: unit-30-native-activation-and-live-region-landmarks
bolt: 0
upstream_stage: null
---

`stages/design/units/unit-30-native-activation-and-live-region-landmarks.md` quality gate 1 (line 24-46) converts `<div role="link">` to native `<a href="#stage-N">` across 10+ stage-progress-strip nodes. The gate specifies focus, Enter, arrow semantics. But state coverage for the new `<a>` elements is missing:

- **hover** — no spec for mouse-hover (browser default underline vs class-based hover).
- **focus-visible** — gate mentions "Tab → focus" but does not specify `focus-visible:ring-*`. FB-93/FB-107 (unit-29) are canonicalizing `focus-visible:ring-*` stage-wide; unit-30's rewrite must add `focus-visible:ring-*` to each anchor or cite the stylesheet rule. Without this, keyboard focus is invisible — exact WCAG 2.4.7 failure FB-107 is fixing on a sibling surface.
- **active** — no spec for pressed state during Enter keydown.
- **disabled** — pseudocode at 380-385 may describe unreachable future stages as disabled. Native `<a>` has no disabled attr; the class treatment must be preserved and documented.
- **:visited** — native `<a href="#stage-N">` inherits browser visited styling (purple) unless suppressed.

Proposed fix: extend quality gate 1 with state-coverage contract:

```
default: text-stone-700 dark:text-stone-300 no-underline
hover: hover:text-teal-600 dark:hover:text-teal-400 hover:underline
focus-visible: focus-visible:ring-2 focus-visible:ring-teal-500
              focus-visible:ring-offset-2  (matches unit-29)
active: active:text-teal-700 dark:active:text-teal-300
:visited: visited:text-inherit
current: aria-current="step" + canonical selection treatment
```

**Sibling conflict:** unit-30 writes to `stage-progress-strip.html` AND unit-28 also writes to `stage-progress-strip.html` (FB-89 gray→stone sweep — 13 occurrences). Both in parallel, no `depends_on`. Add `depends_on: [unit-28]` to unit-30 so palette is normalized before the DOM rewrite lands.
