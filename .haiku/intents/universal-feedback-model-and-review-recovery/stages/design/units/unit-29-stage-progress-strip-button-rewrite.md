---
title: >-
  stage-progress-strip.html — rewrite every `<div role="link">` stage node to
  `<button type="button">` and make upcoming stages keyboard-reachable.
  Restores Enter/Space activation for keyboard users and makes role match
  behavior. Focus-order-spec updated accordingly
type: design
closes:
  - FB-136
depends_on:
  - unit-27-palette-and-sizing-magic-number-normalization
inputs:
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/focus-order-spec.md
outputs:
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/focus-order-spec.md
  - stages/design/artifacts/unit-29-design-review.md
quality_gates:
  - name: no-div-role-link-stage-nodes
    command: "! grep -En '<div[^>]*role=\"link\"' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/stage-progress-strip.html"
  - name: stage-nodes-are-buttons
    command: "python3 -c \"import sys; c = open('.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/stage-progress-strip.html').read(); import re; n = len(re.findall(r'<button[^>]*aria-label=\\\"[^\\\"]*stage', c, re.IGNORECASE)); sys.exit(0 if n >= 10 else 1)\""
  - name: upcoming-stages-keyboard-reachable
    command: "python3 -c \"import sys, re; c = open('.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/stage-progress-strip.html').read(); n = len(re.findall(r'tabindex=\\\"0\\\"[^>]{0,200}aria-disabled=\\\"true\\\"|aria-disabled=\\\"true\\\"[^>]{0,200}tabindex=\\\"0\\\"', c)); sys.exit(0 if n >= 4 else 1)\""
  - name: upcoming-stage-activation-guarded
    command: "grep -E 'aria-disabled.*(true|getAttribute).*return|if\\s*\\(.*aria-disabled.*(true|===)' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/stage-progress-strip.html"
  - name: stage-node-focus-visible-css-present
    command: "grep -E '\\.stage-node:focus-visible|stage-node[^\"]*focus-visible' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/stage-progress-strip.html"
  - name: focus-order-spec-describes-buttons
    command: "grep -E '<button|button type|Enter.*Space' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/focus-order-spec.md"
---
# stage-progress-strip div-role-link to button rewrite

## Scope

**FB-136** — `stage-progress-strip.html` implements every stage node as
`<div tabindex="0" role="link" aria-label="..."`>`. This pattern has three
independent a11y failures:

1. **WCAG 2.1.1 Keyboard** — `<div role="link">` does not get Enter or
   Space activation for free. Native `<a href>` and `<button>` do; div
   does not. There is no `keydown` handler wired in the artifact. A
   keyboard user who tabs to a stage node and presses Enter or Space gets
   nothing.
2. **WCAG 4.1.2 Name, Role, Value** — `role="link"` announces "link" to
   assistive technology and implies page navigation. The actual click
   handler is a tab-switch / scroll-into-view — button behavior, not link.
3. **Upcoming-stage invisibility** — lines 137, 151 (+ reference pipeline
   duplicates) carry `tabindex="-1" role="link" aria-disabled="true"`. A
   `tabindex="-1"` element is unreachable via Tab; `aria-disabled` only
   fires during DOM-browse traversal, which most AT users never trigger.
   Keyboard + screen-reader users cannot discover upcoming stages exist.

FB-82 and FB-84 claimed this was fixed in prior units; the rewrite never
landed. `focus-order-spec.md §9 Implementation contract` already prescribes
the `<button type="button">` pattern — this unit makes the artifact match.

## Approach

**Designer hat:**

1. Convert every stage node in the primary pipeline (lines 91, 105, 119,
   137, 151) and the reference pipeline (lines 190+) from `<div tabindex="0"
   role="link">` to `<button type="button">`. Keep:
   - Same Tailwind classes (`.stage-node`, flex layout).
   - Same `aria-label` attribute.
   - Same `aria-current="step"` on the active stage.
   - Same `aria-disabled="true"` on upcoming stages.
   - Focus-visible ring CSS (already present at approx line 39) stays.
2. For upcoming stages (Operations, Security — lines 137, 151):
   - Change `tabindex="-1"` → `tabindex="0"` so they're keyboard-reachable.
   - Keep `aria-disabled="true"` — the button is still non-activating.
   - Add `aria-describedby="{id}-disabled-reason"` pointing at a hidden
     `<span id="{id}-disabled-reason" class="sr-only">Operations stage
     becomes available after Development review approves</span>`.
   - The `<button disabled>` native attribute is NOT used because the
     button must still be focusable and screen-reader-announceable;
     `aria-disabled` is the correct mechanism for a focusable disabled
     control.
3. Update `focus-order-spec.md §1` rows 4-7 to describe button semantics
   (element = `<button>`, activation = Enter + Space native) and `§9
   Implementation contract` to add the rationale row described in
   `quality_gates`.

**Design-reviewer hat:**

- Run the verification greps. Each must return the stated count.
- Walk the artifact with a keyboard: every stage node receives focus on
  Tab; Enter + Space activation triggers the click handler; upcoming
  stages receive focus but show the "disabled, available after X"
  announcement via aria-describedby.
- Confirm the focus-visible ring still renders on `.stage-node:focus-
  visible`.
- Check for visual regression — `<button>` styling should match the
  pre-rewrite `<div>` appearance (same Tailwind classes; same computed
  display).

**Feedback-assessor hat:**

- Run `grep -En '<div[^>]*role="link"' stages/design/artifacts/stage-
  progress-strip.html` → 0.
- Run the focusable-disabled grep.
- Confirm focus-order-spec.md §1 rows 4-7 + §9 Implementation contract
  updated.
- FB-136 closes on live-grep + spec-update verification.

## Completion criteria

- [ ] No `<div role="link">` in stage-progress-strip.html
- [ ] Every stage node is a `<button type="button">` (both pipelines)
- [ ] Upcoming stages keyboard-reachable with tabindex=0 +
      aria-disabled=true + aria-describedby
- [ ] focus-order-spec.md §1 rows 4-7 + §9 updated
- [ ] Visual regression check: no layout / appearance change
- [ ] FB-136 closes on live-grep verification
