---
title: >-
  unit-30 gate 4 mandates VoiceOver/NVDA screen-reader walk — impossible for
  feedback-assessor to verify
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T15:30:31Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-30-native-activation-and-live-region-landmarks.md
closed_by: null
bolt: 0
upstream_stage: null
---

File: `stages/design/units/unit-30-native-activation-and-live-region-landmarks.md:77-84` (gate 4, closes FB-103 / FB-104)

Gate text: "Design-reviewer walks the rewritten `stage-progress-strip.html` with a screen reader (VoiceOver or NVDA equivalent) and confirms: (a) each stage anchor is announced as 'link, Stage N' on focus; (b) Enter activates the focused stage; (c) arrow keys move focus between stages without activating."

feedback-assessor is an agent running in the FSM — it has no screen-reader, no browser, no keyboard. This gate cannot close. FB-103 cites WCAG 2.1.1 + 4.1.2, both of which ARE measurable at the source level (native element presence + Enter/Space handler in JS). The `role="link"` grep gate at :42 already confirms the native-element conversion; what's missing is a gate that confirms the arrow-key handler was retrained to operate on `a[data-stage]` selectors.

**Proposed fix (diff-level):**

Replace gate 4 with executable structural checks:

```yaml
- >-
  Arrow-key handler at lines 403–438 of post-fix `stage-progress-strip.html`
  queries the native anchor nodes, not `[role="link"]`. Grep gate:
  `grep -nE 'querySelectorAll\(.a\[data-stage\]|querySelectorAll\(.a\.stage-link'
  stages/design/artifacts/stage-progress-strip.html` returns ≥ 1 hit;
  `grep -nE 'querySelectorAll\(.\[role=.link.\]' stages/design/artifacts/stage-progress-strip.html`
  returns 0 hits.
- >-
  The pseudocode table at :380-385 and script block at :400-447 no longer
  claim a custom Enter handler is required. `grep -nE 'Enter.*preventDefault|key === .Enter'
  stages/design/artifacts/stage-progress-strip.html` returns 0 hits in the
  stage-anchor handler (native `<a>` click is browser-provided; Space
  fallback is documented but not implemented as a custom handler).
```

Move the screen-reader-walk requirement to the stage-level `review:` gate if human verification is genuinely required — it does not belong inside a unit's quality_gates list where a machine agent evaluates closure.
