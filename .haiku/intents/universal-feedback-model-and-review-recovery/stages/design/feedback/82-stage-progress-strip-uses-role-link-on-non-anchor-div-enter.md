---
title: >-
  stage-progress-strip uses role="link" on non-anchor div — Enter/Space
  activation not guaranteed
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:59:18Z'
iteration: 3
visit: 3
source_ref: null
closed_by: unit-23-focus-visible-and-activable-element-semantics
---

`stage-progress-strip.html` wraps each stage node in `<div … role="link" tabindex="0" aria-label="…">` (e.g. L87, L101, L115, L133, L147, L186, L196, L211, etc.). This is a known a11y footgun:

**WCAG / ARIA violations:**

1. **`role="link"` on a `<div>` does not automatically activate on Enter or Space.** Native `<a href>` and `<button>` elements inherit the browser's key-handling. `<div role="link">` does NOT — it needs an explicit `onkeydown` handler for Enter. The artifact has no such handler on any stage node.
2. When the user tabs to a stage node and presses Enter, **nothing happens**. Screen-reader users will hear "link, Design stage, completed" but the key press is a no-op.
3. Even if a JS handler is added in dev, `role="link"` implies navigation to a URL, but the stage strip navigates within-app. The correct role is either:
   - `<a href="#stage-design">` (real anchor, preserves Enter handling, real href target), or
   - `<button>` with `aria-current="step"` (the element is really a button that switches stage view, not a link).

4. **Focus-ring spec contradiction:** `focus-ring-spec.html §1` mandates the canonical 2px teal ring on every interactive element. The stage-progress `<div>`s have NO `focus-visible:ring-*` class — relying entirely on the browser default outline which the focus-ring-spec CSS explicitly suppresses (`.focus-demo-*:focus:not(:focus-visible) { outline: none }` patterns). Net effect: no focus ring on stage nodes.

**Verification:**
```
grep -nE 'role="link"|focus-visible:ring' stages/design/artifacts/stage-progress-strip.html | grep stage-node
→ stage-node divs have role="link" + tabindex but no focus-visible class
```

**Fix:**

1. Convert every `<div class="stage-node" role="link" tabindex="0">` to either `<a href="#stage-{slug}" class="stage-node">` (preferred — real anchor, real affordance, no JS required for keyboard activation) or `<button type="button" class="stage-node">` (if SPA routing without hash is used).

2. Remove `role="link"` once the element is a real `<a>` (role is redundant on native anchors).

3. Add `focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 outline-none` to the `.stage-node` class or equivalent.

4. Keep `aria-disabled="true"` on upcoming stages, but ensure it pairs with `tabindex="-1"` (which the artifact already does at L133, L147) AND add `aria-current="step"` only to the active stage (already at L115, L211, correctly).
