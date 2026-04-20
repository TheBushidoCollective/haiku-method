---
title: >-
  stage-progress-strip.html role=link on div has no Enter/Space activation
  handler — keyboard UNREACHABLE
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:29:14Z'
iteration: 4
visit: 4
source_ref: null
closed_by: unit-30-native-activation-and-live-region-landmarks
---

Stage-progress-strip `<div role="link">` nodes at `:91, :105, :119, :137, :151, :190, :200, :215, :229, :242` (and further down the file) are focusable but have NO keyboard activation handler. The arrow-key handler at `:403-438` only moves focus via roving tabindex; it does not listen for `Enter` or `Space` to activate the link.

Because these are `<div role="link">` (not native `<a>` or `<button>`), the browser does not fire any default activation event on Enter/Space — the developer has to implement it. None of the artifact's scripts do. The §Pseudocode block at `:400-447` and the docs at `:380-385` explicitly claim "Enter/Space activates the focused stage," but the shipped script only implements arrow nav + Escape + Home + End. Keyboard users cannot activate a stage link.

This compounds the underlying a11y footgun that ARIA Authoring Practices calls out: use native `<a href>` or `<button>` for links/buttons, not `<div role=...>`. The `<div role="link">` pattern requires you to reimplement every keyboard behavior browsers give you for free on native elements.

**Compare to what the spec on the same page claims (lines 380-385):**

| Key | Behavior |
|---|---|
| Tab / Shift+Tab | Enter / exit the strip |
| Arrow keys | Move between stages |
| **Enter / Space** | **Activate the focused stage (opens stage view)** |
| Escape | Dismiss tooltip without moving focus |

The Enter / Space row is unimplemented in the shipped JS.

**FB-82 was marked "closed" but the divs-with-role-link pattern and the missing handlers persist verbatim.** The supposed fix did not address the root keyboard-activation gap.

**Fix required (pick one):**

1. Convert each `<div role="link">` to a native `<a href="#stage-N" data-stage="N">` (or `<button type="button">` if activation is JS-only). Native elements fire click on Enter (`<a>`) and Enter+Space (`<button>`) for free. Drop `role="link"` entirely. This is the ARIA Authoring Practices recommendation and closes the gap permanently.
2. OR, if the `<div role="link">` must stay for layout reasons, extend the keydown handler to:
   ```js
   if (ev.key === 'Enter' || ev.key === ' ') {
     ev.preventDefault();
     // Activate: same code path as click — navigate/scroll/open tooltip-panel
     nodes[currentIdx].click();  // delegate to click handler
   }
   ```
   and attach a click listener that actually performs the navigation, which is also missing.

Option 1 is strongly preferred — using native semantics eliminates this entire category of bug.

**WCAG refs:** 2.1.1 Keyboard (Level A); 4.1.2 Name, Role, Value (Level A) — a control with role=link that can't be activated by keyboard has no operable value.
