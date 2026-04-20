---
title: >-
  stage-progress-strip.html uses `<div role="link">` without Enter/Space
  activation handlers — WCAG 2.1.1 + 4.1.2 FAIL
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T17:49:18Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

`stage-progress-strip.html` implements every stage node as a `<div tabindex="0" role="link">`. This pattern has three separate a11y failures that FB-82 called out and that were not resolved despite FB-82's closure.

**Live violations (grep verified 2026-04-20):**

- `stage-progress-strip.html:91` — `<div class="stage-node flex flex-col items-center relative" tabindex="0" role="link" aria-label="Inception stage, completed">`
- `stage-progress-strip.html:105` — `<div ... tabindex="0" role="link" aria-label="Design stage, completed">`
- `stage-progress-strip.html:119` — `<div ... tabindex="0" role="link" aria-current="step" aria-label="Development stage, in progress">`
- `stage-progress-strip.html:137` — `<div ... tabindex="-1" role="link" aria-label="Operations stage, upcoming (not in tab order)" aria-disabled="true">`
- `stage-progress-strip.html:151` — same for Security stage.
- Plus a second pipeline at lines 190+ with the same pattern.

**Issue 1 — No native keypress activation (WCAG 2.1.1 Keyboard):**

- `<div role="link">` does NOT get Enter or Space activation for free — only native `<a href>` and `<button>` get that. The stylesheet / artifact has no keydown handler wired. A keyboard user who Tabs to a stage node and presses Enter or Space gets nothing.
- `focus-order-spec.md §9 Implementation contract` explicitly says: "Pins are `<button>`, not `<div>`. `role="button"` is insufficient — native `<button>` inherits default Tab + Enter + Space handling; `<div role="button">` would need manual key handlers and is a known a11y footgun." The same reasoning applies to `<div role="link">` — it's even weaker because `role="link"` doesn't get the Space-key contract that `role="button"` technically does.

**Issue 2 — `role="link"` implies navigation that isn't happening:**

- `role="link"` announces "link" to AT and sets the user expectation of page navigation. The actual click handler (not shown in this artifact) is a tab-switch / scroll-into-view — that's a button behavior, not a link behavior.
- WCAG 4.1.2 Name, Role, Value — role must accurately describe the behavior.

**Issue 3 — `aria-disabled="true"` on non-focusable div does nothing (FB-82 called out):**

- Lines 137, 151 carry `tabindex="-1" role="link" aria-disabled="true"`. With `tabindex="-1"` the element is never reachable via Tab, so `aria-disabled` is announced only if the AT happens to traverse the DOM in browse mode. Most users will never hear it. The comment block at line 134–135 acknowledges this is "deliberate" but the UX consequence is: upcoming stages are invisible to keyboard users entirely, and the tooltip that explains the disabled state only fires on hover (pointer), not on focus.
- Pick one: either keep the node focusable (`tabindex="0"`, not `-1`) and rely on `aria-disabled`, or drop from the DOM entirely. The current half-way state hides the stage from a keyboard user without telling them it exists.

**Fix required:**

1. Change every `<div role="link">` stage node to `<button type="button">` — same Tailwind classes, same tabindex logic, same aria-label, same aria-current="step" on the active stage, same aria-disabled on upcoming. `<button>` gets Enter + Space activation for free. The `role="link"` → `<a href="#...">` alternative is technically correct if you want link semantics (VoiceOver rotor + "Open in new tab" context-menu support), but only if the click handler actually navigates (changes location hash). For a tab-switch / scroll behavior, `<button>` is the correct element.
2. If `<a>` is chosen, the element MUST have a real `href` (even a `#stage-{id}` fragment), and the click handler must call `preventDefault()` + `pushState()` to keep the URL in sync — not silently swallow the click.
3. Make upcoming stages keyboard-reachable: `tabindex="0"` + `aria-disabled="true"` + `aria-describedby` pointing at a hidden explanation, rather than `tabindex="-1"`. This lets screen reader + keyboard users understand what stages exist in the pipeline. The current pattern excludes them entirely.
4. Update `focus-order-spec.md §1 row 4-7` to match the chosen element (button vs. anchor).
5. Re-open FB-82 (marked closed but the `<div role="link">` pattern still ships) and add a verification grep: `grep -En '<div[^>]*role="link"' stages/design/artifacts/stage-progress-strip.html` → must return 0.

**WCAG refs:** 2.1.1 Keyboard (the core failure — div with role="link" has no native key handler); 4.1.2 Name, Role, Value (role="link" on a non-navigating element); 2.4.7 Focus Visible (already addressed by the `.stage-node:focus-visible` CSS — that part is OK); 3.2.4 Consistent Identification (upcoming stages behave differently — some in tab order, some not).
