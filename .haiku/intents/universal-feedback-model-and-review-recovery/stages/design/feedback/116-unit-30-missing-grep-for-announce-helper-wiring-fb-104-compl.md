---
title: >-
  unit-30 missing grep for announce() helper wiring — FB-104 completion-signal
  path unenforced
status: open
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T15:30:43Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-30-native-activation-and-live-region-landmarks.md
closed_by: null
bolt: 0
upstream_stage: null
---

File: `stages/design/units/unit-30-native-activation-and-live-region-landmarks.md:69-76` (gate 2)

Gate says: "Any JS in the affected artifacts that announces a status message is rewritten (or stubbed in the artifact's script block) to call `announce('feedback-live-polite', ...)` / `announce('feedback-live-assertive', ...)` rather than mutating inline toast text directly."

This is prose. There is no grep recipe that confirms the `announce(` call is actually wired in each of the three artifacts. FB-104 explicitly calls out that the PAIR has to be "wired to the `announce(regionId, message)` helper from `aria-live-sequencing-spec.md §2.2`" — the wiring is load-bearing for WCAG 4.1.3 Status Messages (without the helper, the assertive region exists but nothing fires into it on the error path).

**Proposed fix (diff-level):**

Add a falsifiable grep sub-gate:

```yaml
- >-
  Each affected artifact's `<script>` block (or companion JS) contains at
  least one call to the shared helper. Greps (each must return ≥ 1):
  `grep -nE 'announce\((.|")feedback-live-assertive' stages/design/artifacts/revisit-modal-states.html`;
  `grep -nE 'announce\((.|")feedback-live-assertive' stages/design/artifacts/comment-to-feedback-flow.html`;
  `grep -nE 'announce\((.|")feedback-live-polite|announce\((.|")feedback-live-assertive'
  stages/design/artifacts/revisit-unit-list.html`.
- >-
  The top-of-script comment referencing `aria-live-sequencing-spec.md §2.2`
  is present. Grep: `grep -n 'aria-live-sequencing-spec.md' stages/design/artifacts/revisit-modal-states.html`,
  same for the other two artifacts, each returns ≥ 1 hit.
```

Without these, unit-30 can land the two `<div id="feedback-live-*">` nodes at body level, pass the id-presence greps, and still ship the WCAG 4.1.3 failure because nothing writes into the assertive region on the failure path.
