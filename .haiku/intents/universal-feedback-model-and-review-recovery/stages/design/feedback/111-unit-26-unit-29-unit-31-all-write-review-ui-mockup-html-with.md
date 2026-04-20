---
title: >-
  unit-26, unit-29, unit-31 all write review-ui-mockup.html with no depends_on —
  sibling write conflict
status: open
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T15:29:45Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-29-focus-visible-canonicalization-and-spec-clarity.md
closed_by: null
bolt: 0
upstream_stage: null
---

File: `stages/design/units/unit-26-artifact-opacity-ban-enforcement.md`, `unit-29-focus-visible-canonicalization-and-spec-clarity.md`, `unit-31-contrast-and-type-scale-fixes.md`

All three units declare `review-ui-mockup.html` as an output with `depends_on: []`. The overlapping line regions:

- unit-26 rewrites lines 136 + 153 (stage-btn opacity-60 removal)
- unit-29 adds `.stage-btn:focus-visible` `<style>` rules (touches inline style block 1922-1957) and rewrites `focus:ring-*` at lines 214, 277, 278, 971
- unit-31 rewrites lines 43, 146, 163, 802, 1019, 1285, 1496, 1532, 1568 for `text-[11px]`

Lines 136/146/153/163 are adjacent on the same stage-btn elements — unit-26 drops `opacity-60` from 136/153, unit-31 rewrites the `<span>` label at 146/163. Three sibling units modifying the same file with no ordering means whichever runs last clobbers the others' diffs.

**Proposed fix (diff-level):**

In `unit-29-focus-visible-canonicalization-and-spec-clarity.md`:
```yaml
depends_on:
  - unit-26-artifact-opacity-ban-enforcement
```

In `unit-31-contrast-and-type-scale-fixes.md`:
```yaml
depends_on:
  - unit-26-artifact-opacity-ban-enforcement
  - unit-29-focus-visible-canonicalization-and-spec-clarity
```

Chain: unit-26 (opacity removal) → unit-29 (focus-visible rings + css block) → unit-31 (type-scale lifts on the already-re-styled stage-btns). This pins the order the designer must follow so each unit re-reads the prior unit's post-fix file before editing.
