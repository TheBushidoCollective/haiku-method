---
title: >-
  Wireframes use raw oklch on kind/stage/intent chips instead of KIND_BADGE
  token palette
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-28T21:59:41Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-14:bolt-1'
bolt: 1
triaged_at: '2026-04-28T21:59:41Z'
resolution: null
replies: []
---

**Files:** `stages/design/artifacts/wireframes/drift-indicator.html` lines 263–270; `stages/design/artifacts/wireframes/replacement-affordance.html` lines 172–173

**Violation:** Token discipline — raw OKLCH coordinates on semantic chip components.

In `drift-indicator.html`, the `.drift-entry-stage-chip` and `.drift-entry-stage-chip--intent` classes are styled with bare OKLCH values:
```css
/* .drift-entry-stage-chip */
background: oklch(95% 0.025 270);
color: oklch(50% 0.12 270);
/* .drift-entry-stage-chip--intent */
background: oklch(95% 0.025 230);
color: oklch(50% 0.12 230);
```

In `replacement-affordance.html`, `.kind-chip` uses:
```css
background: oklch(95% 0.02 270);
color: oklch(50% 0.12 270);
```

**Why this is a violation:** DESIGN-BRIEF.md Screen 3 lines 357 and 365 explicitly say: *"Stage chip / intent chip — reuses existing `KIND_BADGE` palette: stage = `bg-violet-50 text-violet-700`, intent = `bg-sky-50 text-sky-700`"* and *"Reuse `KIND_BADGE` palette from `StageReview.tsx`."* SPA-UI-SPECS §4.1 further states all semantic surfaces must use token references, not raw values.

These chips communicate semantic categories (stage vs intent scope). Using raw OKLCH coordinates instead of named palette classes breaks the token chain: a future accent-color update to violet/sky in `globals.css` will not propagate to these values, and development-stage implementers will have no cue to reach for existing Tailwind utilities.

**Fix:** Replace raw oklch with Tailwind palette classes `bg-violet-50 text-violet-700` / `bg-sky-50 text-sky-700`, or CSS custom property references if defined in the `@theme` block. DESIGN-TOKENS §1.4 explicitly permits Tailwind palette classes for existing utilities already in the codebase.
