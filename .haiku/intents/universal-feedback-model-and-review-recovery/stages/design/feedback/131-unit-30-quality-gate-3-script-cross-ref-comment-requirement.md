---
title: >-
  unit-30 quality gate 3 script cross-ref comment requirement lacks grep recipe
  — unfalsifiable
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:35:07Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-30-native-activation-and-live-region-landmarks.md
closed_by: unit-30-native-activation-and-live-region-landmarks
bolt: 0
upstream_stage: null
---

`stages/design/units/unit-30-native-activation-and-live-region-landmarks.md` quality gate 3 (line 69-76):

> "Any JS in the affected artifacts that announces a status message is rewritten (or stubbed in the artifact's script block) to call `announce('feedback-live-polite', ...)` / `announce('feedback-live-assertive', ...)` rather than mutating inline toast text directly. The `announce()` helper signature and debounce contract already exists in `aria-live-sequencing-spec.md §2.2`; each artifact's script references that spec in a top-of-file comment."

Two unfalsifiable parts:

1. "Any JS ... is rewritten to call `announce('feedback-live-polite', ...)`" — no grep recipe. A designer could skip rewriting any call sites and only add the region nodes (which quality gate 2 checks via `grep -c 'id="feedback-live-polite"'`). The assertive-vs-polite sequencing contract §2.2 warns about would remain broken.

2. "each artifact's script references that spec in a top-of-file comment" — no grep recipe for the comment.

Proposed fix: add two grep checks to quality gate 3:

```bash
# (a) announce() call sites land in each artifact's <script>
grep -cE "announce\('feedback-live-(polite|assertive)'" \
    stages/design/artifacts/revisit-modal-states.html      # ≥ 2 (polite + assertive)
grep -cE "announce\('feedback-live-(polite|assertive)'" \
    stages/design/artifacts/comment-to-feedback-flow.html  # ≥ 1 (assertive newly added)
grep -cE "announce\('feedback-live-(polite|assertive)'" \
    stages/design/artifacts/revisit-unit-list.html         # ≥ 1

# (b) top-of-file cross-ref comment
grep -c 'aria-live-sequencing-spec.md' \
    stages/design/artifacts/revisit-modal-states.html      # ≥ 1
grep -c 'aria-live-sequencing-spec.md' \
    stages/design/artifacts/comment-to-feedback-flow.html  # ≥ 1
grep -c 'aria-live-sequencing-spec.md' \
    stages/design/artifacts/revisit-unit-list.html         # ≥ 1
```

Without these, the gate is satisfied by merely adding empty sr-only `<div>` nodes with no wiring — the page-level pair exists but nothing announces into it, which is the same functional gap FB-104 was filed to close.
