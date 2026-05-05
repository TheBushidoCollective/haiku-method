---
title: >-
  Replace modal drop zone carries wrong aria-label "Upload knowledge file" in
  replacement context
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-28T22:00:33Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-18:bolt-1'
bolt: 1
triaged_at: '2026-04-28T22:00:33Z'
resolution: null
replies: []
---

**File:** `stages/design/artifacts/wireframes/replacement-affordance.html` lines 734, 795, 886

**Violation:** Component naming / ARIA string consistency — the replace modal's drop zone reuses the Knowledge Upload Panel's exact `aria-label` string in a semantically different context.

All three instances of the replace-output modal drop zone in the wireframe use:
```html
aria-label="Upload knowledge file"
```

This string is the **authoritative, required label for the Knowledge Upload Panel's drop zone** (SPA-UI-SPECS §1.4: *"Drop-zone element: `role="button"`, `tabIndex={0}`, `aria-label="Upload knowledge file"` (matches the spec verbatim — this exact string is required)"*). It was fixed there precisely because screen-reader users need to hear a meaningful announcement when they land on the control.

In the replace-output modal, the user is not uploading to the knowledge directory. They are **replacing a specific stage output artifact**. Announcing "Upload knowledge file" when the user's goal is to replace `hero-mockup.html` misdirects screen-reader users — it implies the wrong destination and the wrong action.

SPA-UI-SPECS §2.6 specifies the `⋯` button's aria-label format (`aria-label="Output actions for {artifact-name}"`) but does not explicitly specify the drop zone's aria-label for the modal. DESIGN-BRIEF §Screen 2 Accessibility Requirements also does not enumerate a specific string for this drop zone — it defers to Screen 1's drop zone pattern. This is a gap that the wireframe filled with the wrong string.

The contextually correct label would be something like: `aria-label="Drop replacement file for {artifact-name}"` (e.g. `"Drop replacement file for hero-mockup.html"`), which communicates both the action (replacement, not upload) and the scope (specific artifact).

**Fix:** Replace all three instances of `aria-label="Upload knowledge file"` on the replace-modal drop zone with `aria-label="Drop replacement file for {artifact-name}"` (interpolated with the actual artifact filename), and document this string in SPA-UI-SPECS §2.6 alongside the `⋯` button's aria-label. This eliminates the ambiguity for implementers and screen-reader users alike.
