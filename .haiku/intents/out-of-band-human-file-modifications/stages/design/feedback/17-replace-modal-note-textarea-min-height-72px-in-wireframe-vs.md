---
title: >-
  Replace modal note textarea min-height 72px in wireframe vs 80px specified in
  DESIGN-BRIEF
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-28T22:00:17Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-17:bolt-1'
bolt: 1
triaged_at: '2026-04-28T22:00:17Z'
resolution: null
replies: []
---

**File:** `stages/design/artifacts/wireframes/replacement-affordance.html` line 440

**Violation:** Spacing value in wireframe diverges from the design spec without explanation.

The wireframe CSS:
```css
.note-textarea {
  min-height: 72px;
  ...
}
```

DESIGN-BRIEF.md Screen 2 line 231 specifies: *"Note textarea — `min-h-[80px]`, atoms.Input rules, `font-mono text-sm`."* That is 80px, not 72px.

SPA-UI-SPECS §2.8 Responsive Behavior only explicitly overrides the mobile textarea height (to `min-height: 120px`). It does not override the desktop value, so DESIGN-BRIEF's 80px stands as the authoritative desktop spec.

72px is 2 spacing units short of the spec. This is not a structural colors exemption (SPA-UI-SPECS §4.1 only permits raw Tailwind palette classes for structural colors, not arbitrary spacing values). The 8px gap between spec and wireframe creates an ambiguity: development stage implementers referencing the wireframe will build to 72px while the spec says 80px.

DESIGN-TOKENS §2.1 uses the existing Tailwind v4 spacing scale; `min-h-[80px]` is a valid utility. The correct wireframe value is `min-height: 80px`.

**Fix:** Change `min-height: 72px` to `min-height: 80px` in the `.note-textarea` CSS rule, aligning the wireframe with DESIGN-BRIEF §Screen 2 line 231.
