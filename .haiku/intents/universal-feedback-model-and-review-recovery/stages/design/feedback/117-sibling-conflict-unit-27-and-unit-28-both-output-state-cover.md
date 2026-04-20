---
title: >-
  Sibling conflict — unit-27 and unit-28 both output state-coverage-grid.md and
  DESIGN-BRIEF.md with no declared ordering
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:30:48Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-27-spec-alignment-and-design-brief-completeness.md
closed_by: unit-28-canonical-token-normalization-sweep
bolt: 0
upstream_stage: null
---

`stages/design/units/unit-27-spec-alignment-and-design-brief-completeness.md:19-23` declares `outputs: [DESIGN-BRIEF.md, state-coverage-grid.md, revisit-modal-states.html, unit-27-design-review.md]` and `depends_on: []`.

`stages/design/units/unit-28-canonical-token-normalization-sweep.md:26-38` declares `outputs: [DESIGN-BRIEF.md, ..., state-coverage-grid.md, ..., unit-28-design-review.md]` and `depends_on: []`.

Both units modify the same two files with no declared serialization:

- **`state-coverage-grid.md`** — unit-27 rewrites rows 52, 73, 132, 150, 190 (disabled/locked state-treatment cells). unit-28 adds a new `§0 Component-name canonical` section (per its quality gate 6, line 108) pinning `FeedbackSheet` as canonical. Row 22 + §7.8 are also touched by unit-28's FB-96 sweep ("`state-coverage-grid.md:22` + §7.8"). These land in parallel bolts; whichever writes second silently overwrites the other's edits unless `depends_on` serializes them.

- **`DESIGN-BRIEF.md`** — unit-27 adds §2 specs for `AssessorSummaryCard` / `StageProgressStrip` / `RevisitModal` plus three §9 file-inventory rows (per quality gates 3–4). unit-28 edits §2 line 38 (sidebar width), line 119 (`FeedbackSheet (aka MobileFeedbackPanel)` collapse), line 597 (Retired row), line 810 (accessibility prose). Both write to §2 simultaneously.

Proposed fix: declare ordering explicitly. Either:

1. Add `depends_on: [unit-27]` to unit-28 (unit-27 lands the new §2 specs first, then unit-28 sweeps tokens + component-name drift inside those specs), OR
2. Add `depends_on: [unit-28]` to unit-27 (unit-28 normalizes first, then unit-27 adds new specs that already cite the canonical name).

Option 1 is safer because unit-28's component-name sweep needs to touch the new §2 specs unit-27 writes (otherwise the new `FeedbackSheet` spec block could accidentally reintroduce `MobileFeedbackPanel` drift). Recommend:

```yaml
# unit-28 frontmatter
depends_on:
  - unit-27
```
