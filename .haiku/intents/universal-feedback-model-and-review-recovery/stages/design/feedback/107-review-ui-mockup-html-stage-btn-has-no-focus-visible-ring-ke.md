---
title: >-
  review-ui-mockup.html .stage-btn has no focus-visible ring — keyboard focus
  invisible (WCAG 2.4.7)
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:30:51Z'
iteration: 4
visit: 4
source_ref: null
closed_by: unit-29-focus-visible-canonicalization-and-spec-clarity
---

The six `.stage-btn` buttons in `review-ui-mockup.html` (lines 66, 83, 100, 118, 136, 153) use `focus:outline-none` and have NO replacement focus-visible ring. The companion `<style>` block at lines 1922-1957 defines:

```css
.stage-btn { position: relative; }
.stage-btn .stage-icon {
  outline: 0 solid transparent;
  outline-offset: 2px;
  border-radius: 9999px;
  transition: outline-color 120ms ease, outline-width 120ms ease;
}
.stage-btn.stage-active .stage-icon {
  outline: 3px solid rgb(56 189 248); /* sky-400 */
}
html.dark .stage-btn.stage-active .stage-icon {
  outline-color: rgb(125 211 252); /* sky-300 */
}
```

The only outline ever rendered is the `.stage-active` (selected-state) outline in sky — that is a **selection indicator**, not a focus indicator. A keyboard user tabbing through stages gets zero visible focus feedback on any of the six stage buttons, and cannot tell which one will activate when they press Enter.

Compare to the canonical pattern from `focus-ring-spec.html`:

```css
.stage-btn:focus-visible .stage-icon {
  outline: 3px solid rgb(20 184 166); /* teal-500 — distinct from the sky selection color */
  outline-offset: 3px;
}
```

This is a WCAG 2.4.7 Focus Visible failure — "any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible."

**Fix required:**

Add a `.stage-btn:focus-visible .stage-icon` rule (and dark-mode counterpart) that lights up in teal-500 / teal-400 — a distinct color from the sky-400 selection color so users can tell "I've focused this" apart from "this is the selected stage." Preserve `focus:outline-none` only to suppress the default browser outline; the focus-visible rule provides the replacement.

Also verify other `focus:outline-none` sites that look similar — `review-ui-mockup.html:214` (textarea), `:266` (Confirm & Revisit button) — those DO pair with `focus:ring-2 focus:ring-teal-500`, which is the correct pattern. The six stage buttons are the only `focus:outline-none` instances in this file missing the replacement ring.

**WCAG refs:** 2.4.7 Focus Visible (Level AA).
