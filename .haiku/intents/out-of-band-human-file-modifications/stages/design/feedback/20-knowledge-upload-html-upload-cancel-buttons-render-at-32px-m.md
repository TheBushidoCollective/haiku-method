---
title: >-
  knowledge-upload.html: Upload/Cancel buttons render at 32px min-height at
  tablet (768px), below 44px spec requirement
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-28T22:01:14Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-20:bolt-1'
bolt: 1
triaged_at: '2026-04-28T22:01:14Z'
resolution: null
replies: []
---

## Finding

In `wireframes/knowledge-upload.html`, the `.btn-primary` and `.btn-secondary` CSS rules define `min-height: 32px` (lines 356 and 377). No media query overrides this at tablet (768px), and no `.touch-target` class is applied to these buttons in the tablet demo section.

The tablet wireframe (lines 750–753) renders the Upload/Cancel buttons directly from these CSS classes without any inline height override:

```html
<div class="ku-actions">
  <button class="btn-secondary">Cancel</button>
  <button class="btn-primary">Upload 1 file</button>
</div>
```

**Spec §4.2 states:** "Every pointer-activated control at ≤768px breakpoints applies `.touch-target`... Upload button... Cancel button." The 44px minimum is non-negotiable per the spec.

By contrast, the mobile demo (line 793–795) correctly applies `style="height:44px"` inline. The tablet breakpoint has no equivalent override, leaving both action buttons at 32px — a spec violation that will be silently inherited by the implementation if not corrected in the wireframe.

The same 32px min-height applies to the desktop states (lines 578–579, 637–638, 676–678), but desktop-only usage (≥1280px) is exempt from the 44px touch-target requirement since touch is not expected at that breakpoint.

## Remediation

Add a `@media (max-width: 768px)` rule (or update the existing `@media (max-width: 375px)` to `(max-width: 768px)`) that sets:

```css
.btn-primary, .btn-secondary {
  min-height: 44px;
}
```

Alternatively, apply `style="min-height:44px"` inline on the button elements in the tablet demo section (lines 750–753), consistent with how the mobile section handles it.

Also consider applying `.touch-target` to the buttons in the tablet demo markup to make the intent explicit for the implementation team.

**No change needed to the desktop (1280px) states.**
