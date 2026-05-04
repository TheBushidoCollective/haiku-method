---
title: >-
  knowledge-upload.html success toast uses raw oklch(55% 0.14 145) instead of a
  named token
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-28T21:59:58Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-16:bolt-1'
bolt: 1
triaged_at: '2026-04-28T21:59:58Z'
resolution: null
replies: []
---

**File:** `stages/design/artifacts/wireframes/knowledge-upload.html` line 705

**Violation:** Token discipline — raw OKLCH coordinate on a semantic success-state color in a user-visible surface.

```html
<div style="padding: 6px 12px; font-size: 12px; color: oklch(55% 0.14 145); ...">
  <span aria-hidden="true">✓</span>
  <span>Uploaded 3 files to intent knowledge</span>
</div>
```

`oklch(55% 0.14 145)` is a green-600 family value used to signal upload success. This is a semantic state color — it communicates "upload succeeded" — and therefore falls squarely within SPA-UI-SPECS §4.1's rule: *"any color that communicates a semantic state … MUST be a `var(--token-name)` reference or a token-aliased Tailwind utility."*

DESIGN-TOKENS §1.3.2 defines `--color-drift-acknowledged-fg` (green-700 family) for the "acknowledged / done and quiet" lifecycle state. DESIGN-TOKENS §1.2 identifies `--color-feedback-closed-fg` (green family) as the existing semantic alias for closed/success in the feedback system. Either is the correct reference for this success text; raw OKLCH is not.

The DESIGN-TOKENS §1.1 note also states: *"Downstream work consumes them by Tailwind class name (e.g. `bg-stone-100`, `text-rose-600`) — never by hex literal, never by raw OKLCH coordinates."*

**Fix:** Replace `color: oklch(55% 0.14 145)` with `color: var(--color-drift-acknowledged-fg)` or the Tailwind utility equivalent (`text-green-700 dark:text-green-300`), referencing whichever existing token the design system uses for "operation succeeded."
