---
title: >-
  unit-28 FB-96 grep exclusion list misses stages/design/units/unit-27 where new
  §2 specs will reference FeedbackSheet
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:32:20Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-28-canonical-token-normalization-sweep.md
closed_by: null
bolt: 0
upstream_stage: null
---

`stages/design/units/unit-28-canonical-token-normalization-sweep.md` quality gate 6 (line 92-114) sweeps `MobileFeedbackPanel` → `FeedbackSheet` stage-wide. The grep gate at line 111-114:

```bash
grep -rn 'MobileFeedbackPanel' stages/design/ knowledge/ \
  | grep -v 'stages/design/units/unit-19' \
  | grep -v 'stages/design/units/unit-22' \
  | grep -v 'stages/design/feedback/'
```

Excludes unit-19 and unit-22 as frozen docs, plus feedback/. But:

- **unit-27 (sibling, in flight this iteration)** authors new DESIGN-BRIEF §2 specs and the feedback-assessor validation text in its body. Unit-27 itself never mentions `MobileFeedbackPanel`, but the naming risk is real — if any designer drafting unit-27 copies language from state-coverage-grid before unit-28 lands, the string reappears.
- **Other unit docs (unit-26, unit-29, unit-30, unit-31)** already reference component names in scope descriptions and could reintroduce drift.

Proposed fix: simplify the exclusion to cover the entire units/ tree since all unit docs are internal authoring scratchpads, not the live design spec surface:

```bash
grep -rn 'MobileFeedbackPanel' stages/design/ knowledge/ \
  | grep -v 'stages/design/units/' \
  | grep -v 'stages/design/feedback/'
# Returns 0 hits against live spec + knowledge files only
```

This matches how the ban is scoped in FB-96 (the feedback body targets DESIGN-BRIEF, state-coverage-grid, aria-*specs* — all live authored artifacts, not unit docs).
