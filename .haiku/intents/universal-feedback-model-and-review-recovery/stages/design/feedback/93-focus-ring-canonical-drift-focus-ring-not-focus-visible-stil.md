---
title: >-
  Focus-ring canonical drift: `focus:ring-*` (not `focus-visible:`) still on
  inputs, tabs, pins across ~10 artifacts
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T09:27:20Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

DESIGN-BRIEF §2 declares the canonical Input/Textarea focus ring (line 37):

> `focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900` (canonical focus-ring — matches `focus-ring-spec.html §1`; the earlier single-ring shorthand was retired as of unit-16)

And `focus-ring-spec.html §1` explicitly mandates `:focus-visible` only — "no ring on mouse click". Using `focus:ring-*` (without `-visible`) paints the ring on mouse click too, violating the canonical spec.

Current state — widespread drift of `focus:ring-teal-500` / `focus:ring-teal-400` (no `-visible`):

- `feedback-inline-mobile.html:118-120` — tablist buttons use `focus:ring-2 focus:ring-teal-500`.
- `keyboard-shortcut-map.html:550` — checkbox uses `focus:ring-teal-500`.
- `assessor-summary-card.html:275,317` — prose spec documents the OLD pattern instead of canonical `focus-visible:`.
- `feedback-inline-desktop.html:208,229,237` — three pin markers use `focus:ring-2 focus:ring-teal-400` (not `focus-visible:`).
- `feedback-inline-desktop.html:479` — a feedback card `role="listitem"` uses `focus:ring-2 focus:ring-teal-500`.
- `annotation-gesture-spec.html:226` — pin overlay uses `focus:ring-2 focus:ring-teal-500`.
- `review-ui-mockup.html:214,277,278,971` — sidebar textarea, annotation inputs, "Next unseen" button.
- `annotation-popover-states.html:191,193,244,246,299` — five popover inputs/textareas.

Since the spec was updated by unit-16 but the artifacts weren't swept, dev-stage will wire `focus:ring-*` in React and lose the keyboard vs mouse distinction.

Fix: sweep every `focus:ring-` occurrence across `stages/design/artifacts/*.html` and rewrite to `focus-visible:ring-` (keep the same ring width/color/offset). `focus:outline-none` stays — outline suppression is unconditional.

Post-fix gate: `grep -rEn 'focus:ring-(1|2|teal|amber|red|green)' stages/design/artifacts/` returns 0 (after stripping the `focus:outline-none` + `focus-visible:ring-*` canonical combos). Also update the prose in `assessor-summary-card.html:275,317` to document the canonical `focus-visible:` pattern.
