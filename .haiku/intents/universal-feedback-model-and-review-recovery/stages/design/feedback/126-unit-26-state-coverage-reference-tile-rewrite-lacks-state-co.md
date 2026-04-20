---
title: >-
  unit-26 state-coverage reference-tile rewrite lacks state-coverage grep recipe
  — unfalsifiable completion criterion
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:32:54Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-26-artifact-opacity-ban-enforcement.md
closed_by: null
bolt: 0
upstream_stage: null
---

`stages/design/units/unit-26-artifact-opacity-ban-enforcement.md` quality gate 1 (line 28-47) says:

> "The state-coverage reference tiles at lines 345, 393 are rewritten to describe the same muted-background state language rather than 'opacity 60%'."

This sentence describes a *prose rewrite* inside `revisit-unit-list.html` but provides no falsifiable grep recipe for "muted-background state language rather than 'opacity 60%'". The quality gate falls back to `grep -n 'opacity-60' stages/design/artifacts/revisit-unit-list.html` returns 0, which proves the class is gone but does NOT prove the prose literally says "bg-stone-50 dark:bg-stone-900/60 + dashed border" instead of just being silent.

Compare with the stage-wide enforcement pattern (quality gate 6, line 101-108) which does provide a concrete `grep -rnE 'opacity-(50|60)' stages/design/artifacts/*.html` recipe with explicit allow-list rules.

Proposed fix: add a falsifiable grep for the state-tile prose rewrite:

```bash
# After rewrite, the tile prose must describe the canonical muted-background treatment.
grep -n 'opacity 60%' stages/design/artifacts/revisit-unit-list.html  # returns 0 hits
grep -nE 'bg-stone-50|bg-stone-100|dashed border|muted surface' \
    stages/design/artifacts/revisit-unit-list.html  # returns ≥ 2 hits (one per reference tile)
```

Without this, a designer could delete `opacity-60` and leave the tile body text empty — the `grep -n 'opacity-60'` returns 0 and the gate passes, but the canonical state language the gate claims to enforce never lands.
