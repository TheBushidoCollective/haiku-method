---
title: >-
  unit-30 inputs aria-landmark-spec.md + aria-live-sequencing-spec.md but does
  not declare them as outputs
status: open
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T15:31:30Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-30-native-activation-and-live-region-landmarks.md
closed_by: null
bolt: 0
upstream_stage: null
---

File: `stages/design/units/unit-30-native-activation-and-live-region-landmarks.md:10-22` (inputs/outputs)

unit-30 lists `aria-landmark-spec.md` and `aria-live-sequencing-spec.md` as `inputs:` (lines 13-14) but NOT as `outputs:`. FB-104 is explicit that the canonical live-region pair is prescribed by the landmark spec — any coverage-table update in `aria-landmark-spec.md` noting that revisit-modal-states.html, comment-to-feedback-flow.html, and revisit-unit-list.html now carry the pair would require writing the spec, not just reading it.

Similarly, if unit-30 adds a new "these three artifacts now wire announce() via §2.2 helper" note to `aria-live-sequencing-spec.md`, that's also an output.

Without declaring these as outputs, a future audit of "which unit last modified aria-landmark-spec.md" will not show unit-30 in the log, and the spec may drift out of sync with the three artifacts it claims to govern.

**Proposed fix (diff-level):**

In `unit-30-native-activation-and-live-region-landmarks.md` frontmatter:

```yaml
outputs:
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/comment-to-feedback-flow.html
  - stages/design/artifacts/revisit-unit-list.html
  - stages/design/artifacts/aria-landmark-spec.md          # NEW — coverage row updates
  - stages/design/artifacts/aria-live-sequencing-spec.md   # NEW — announce() wiring note
  - stages/design/artifacts/unit-30-design-review.md
```

If the specs deliberately don't need updating, the unit body should add a one-line "No spec changes required because the specs already describe the canonical pattern; only the three artifacts are brought into compliance" — currently the scope is ambiguous.
