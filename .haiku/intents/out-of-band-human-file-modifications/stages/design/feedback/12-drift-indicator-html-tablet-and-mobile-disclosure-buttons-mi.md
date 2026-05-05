---
title: >-
  drift-indicator.html: tablet and mobile disclosure buttons missing
  aria-controls
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-28T20:32:31Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-12:bolt-3'
bolt: 3
triaged_at: '2026-04-28T20:32:31Z'
resolution: null
replies: []
---

## Finding

The disclosure toggle button in the drift strip is correctly specced in `SPA-UI-SPECS.md §3.5`:

> "Disclosure: `aria-expanded` + `aria-controls` on the toggle, wired to the entry list region"

The desktop expanded state wireframe follows this correctly (line 436–437: `aria-expanded="true"` and `aria-controls="drift-entry-list-2"`).

However, the tablet (line 572) and mobile (line 627–631) renderings of the same disclosure button omit `aria-controls` entirely:

**Tablet (line 572):**
```html
<button class="drift-disclosure" aria-expanded="true">▴ Hide files</button>
```

**Mobile (lines 627–631):**
```html
<button
  class="drift-disclosure"
  aria-expanded="true"
  style="margin-top:6px; font-size:11px; min-height:44px; min-width:44px;"
>
  ▴ Hide files
</button>
```

Neither has an `aria-controls` attribute pointing to the expanded entry list container. Without `aria-controls`, screen readers can announce the expanded/collapsed state but cannot programmatically associate the button with the controlled region. This breaks the semantic relationship for AT that uses `aria-controls` to navigate directly to the controlled content.

The spec note at the bottom of `drift-indicator.html` (line 678) documents the `aria-controls` requirement but does not flag these two omissions.

## Required fix

Add `aria-controls` to the tablet disclosure button (pointing to the `drift-entry-list` element in the tablet section, which needs a matching `id`) and to the mobile disclosure button (pointing to the mobile `drift-entry-list` element, which also needs an `id`).

## File:line references

- `wireframes/drift-indicator.html:572` — tablet disclosure button: `aria-expanded="true"` but no `aria-controls`
- `wireframes/drift-indicator.html:627` — mobile disclosure button: `aria-expanded="true"` but no `aria-controls`
- `wireframes/drift-indicator.html:574` — tablet `.drift-entry-list` div: needs `id` attribute
- `wireframes/drift-indicator.html:637` — mobile `.drift-entry-list` div: needs `id` attribute
- `artifacts/SPA-UI-SPECS.md:327` — §3.5 requirement source for `aria-controls`
