---
title: >-
  unit-29 gate 3 relies on "Manual walk" to verify focus-visible vs selection —
  WCAG 2.4.7 needs executable selector grep
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T15:30:16Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-29-focus-visible-canonicalization-and-spec-clarity.md
closed_by: unit-29-focus-visible-canonicalization-and-spec-clarity
bolt: 0
upstream_stage: null
---

File: `stages/design/units/unit-29-focus-visible-canonicalization-and-spec-clarity.md:56-72` (gate for `.stage-btn` focus-visible ring, closes FB-107)

Gate says: "(b) Manual walk of the six `.stage-btn` buttons confirms the teal focus ring paints on Tab, not on mouse click." This closes the accessibility-authored FB-107 which cites WCAG 2.4.7 Focus Visible (Level AA). "Manual walk" is not falsifiable by feedback-assessor — the assessor is an LLM agent, not a browser.

The gate already has `grep -n ':focus-visible' stages/design/artifacts/review-ui-mockup.html` returns ≥ 2 hits — good, but that just proves presence, not correctness. It needs a companion grep that proves the NEW rule uses a DISTINCT color from the sky-400 selection indicator (the whole point of FB-107).

**Proposed fix (diff-level):**

Replace gate (b) with a grep that enforces both presence and color-distinctness:

```yaml
- >-
  `.stage-btn:focus-visible .stage-icon` rule in the `<style>` block uses
  a teal outline color (`rgb(20 184 166)` or `rgb(45 212 191)` for dark),
  distinct from the sky-400 `.stage-active` selection indicator. Grep proof:
  `grep -nE '\.stage-btn:focus-visible[^{]*\{[^}]*rgb\(20 184 166\)|rgb\(45 212 191\)'
  stages/design/artifacts/review-ui-mockup.html` (multiline-aware; or split
  into two single-line greps that each confirm the selector line and the
  color line are adjacent) returns ≥ 2 hits (light + dark). The
  `.stage-active` rule keeps its `rgb(56 189 248)` sky-400 color —
  `grep -nE '\.stage-btn\.stage-active' stages/design/artifacts/review-ui-mockup.html`
  returns ≥ 1 hit and still uses sky, not teal.
```

Drop the "Manual walk" sub-clause entirely. If the user genuinely wants a human-in-the-loop verification for keyboard behavior, elevate it to the stage `review:` gate (`ask`) rather than hiding it inside a unit quality gate.
