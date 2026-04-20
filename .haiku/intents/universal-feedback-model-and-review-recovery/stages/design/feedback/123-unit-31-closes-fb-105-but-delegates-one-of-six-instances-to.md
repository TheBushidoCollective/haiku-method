---
title: >-
  unit-31 closes FB-105 but delegates one of six instances to unit-29 with no
  depends_on wiring
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:31:53Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-31-contrast-and-type-scale-fixes.md
closed_by: unit-31-contrast-and-type-scale-fixes
bolt: 0
upstream_stage: null
---

`stages/design/units/unit-31-contrast-and-type-scale-fixes.md:6-8` declares `closes: [FB-105, FB-106, FB-109]`. FB-105 enumerates `text-[11px]` violations across FIVE artifacts: `review-ui-mockup.html`, `keyboard-shortcut-map.html`, `feedback-lifecycle-transitions.html`, `focus-ring-spec.html`, `review-package-structure.html`.

unit-31 quality gate 3 line (j) (line 70) explicitly defers `focus-ring-spec.html:108` to unit-29: *"(j) `focus-ring-spec.html:108` — already covered by **unit-29** (lifted to `text-xs`); this unit does not re-touch it."*

Meanwhile `stages/design/units/unit-29-focus-visible-canonicalization-and-spec-clarity.md:6-10` declares `closes: [FB-93, FB-107, FB-110]` — it does NOT close FB-105, and its quality gate 4 line 89 fixes only line 108 of `focus-ring-spec.html`.

Two problems:

1. **No `depends_on`**: unit-31 cannot verify FB-105 closure without first confirming unit-29 has landed `focus-ring-spec.html:108`. Nothing in either unit's frontmatter serializes this.
2. **FB-105 closure condition split across units**: unit-31's feedback-assessor gate (line 94-97) runs "the FB-105 / FB-106 / FB-109 per-line grep recipes". One of the FB-105 per-line recipes targets `focus-ring-spec.html:108`, which unit-31 does not touch. If unit-29 hasn't landed (or landed differently than the FB-105 recipe expects), unit-31's assessor gate fails even though unit-31 did everything in its scope correctly.

Proposed fix — pick one:

**Option A (recommended):** make unit-29 co-close FB-105 by adding it to its `closes:` list and having its quality gate 4 explicitly satisfy the FB-105 recipe for that one line. Then unit-31 needs `depends_on: [unit-29]` so its assessor runs after unit-29 has landed.

```yaml
# unit-29 frontmatter
closes:
  - FB-93
  - FB-105  # ADD — partially closes, shared with unit-31
  - FB-107
  - FB-110

# unit-31 frontmatter
depends_on:
  - unit-29
```

**Option B:** remove `focus-ring-spec.html:108` from FB-105's scope entirely by pulling it back into unit-31's outputs (add `focus-ring-spec.html` to unit-31 inputs + outputs, let unit-31 own that one line). Then unit-29 and unit-31 both modify `focus-ring-spec.html` — which reintroduces a sibling conflict. Option A is cleaner.
