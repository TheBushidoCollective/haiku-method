---
title: >-
  replacement-affordance.html: Replace modal missing aria-labelledby and
  aria-describedby (required by spec §2.6)
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-28T20:26:20Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-09:bolt-3'
bolt: 3
triaged_at: '2026-04-28T20:26:20Z'
resolution: null
replies: []
---

## Finding

`SPA-UI-SPECS.md §2.6` explicitly requires:

> "Replace modal: native `<dialog>` element; `aria-labelledby` on dialog title; `aria-describedby` on dialog body"

The wireframe at `wireframes/replacement-affordance.html` renders both the default state (lines ~706–760) and the mime-mismatch state (lines ~764–815) of the Replace modal using `<div class="modal-dialog">` without either attribute. Neither the modal-title `<span>` nor the modal-body `<div id="replace-dialog-body">` are wired via `aria-labelledby` / `aria-describedby` to the dialog container.

A screen reader encountering the native `<dialog>` without these attributes will announce it without a meaningful title. The user lands in the dialog (focus goes to the drop zone per §2.7 tab order) with no announced context about what dialog they have opened.

This violates WCAG 2.4.6 (Headings and Labels) and the spec's own ARIA requirement. It is also directly relevant to the screen-reader flow check in the mandate.

## Required fix

The modal-dialog element must carry:
```html
<dialog
  aria-labelledby="replace-dialog-title"
  aria-describedby="replace-dialog-body"
>
  <div class="modal-header">
    <span id="replace-dialog-title" class="modal-title">Replace output: hero-mockup.html</span>
    ...
  </div>
  <div class="modal-body" id="replace-dialog-body">
    ...
  </div>
</dialog>
```

The wireframe uses `<div class="modal-dialog">` instead of `<dialog>`, which is acceptable for a static mockup, but the `aria-labelledby`/`aria-describedby` wiring must be shown in the wireframe so the implementation has a clear spec to follow. Both attributes and their corresponding `id` values must be added.

## File:line references

- `wireframes/replacement-affordance.html:707` — `<div class="modal-dialog">` (default state) — missing `aria-labelledby` and `aria-describedby`
- `wireframes/replacement-affordance.html:767` — `<div class="modal-dialog">` (mime mismatch state) — same omission
- `wireframes/replacement-affordance.html:709` — `<span class="modal-title">` — needs `id` attribute
- `wireframes/replacement-affordance.html:712` — `<div class="modal-body" id="replace-dialog-body">` — `id` exists but is not referenced by dialog
- `artifacts/SPA-UI-SPECS.md:241` — requirement source

## Resolution (designer, bolt 1)

Wired ARIA on both Replace modal states in `wireframes/replacement-affordance.html`:

- Default state modal-dialog now carries `role="dialog"`, `aria-modal="true"`, `aria-labelledby="replace-dialog-title"`, `aria-describedby="replace-dialog-body"`. Title span gets `id="replace-dialog-title"`; body div already had `id="replace-dialog-body"`.
- Mime-mismatch state modal-dialog carries the same attribute set with disambiguated ids `replace-dialog-title-mime` / `replace-dialog-body-mime` so both mockups can coexist on one HTML page without duplicate-id collisions. Title span and body div carry the matching ids.

Implementation guidance: production uses native `<dialog>` per §2.6; the id-suffix scheme used here exists only because both states render in one wireframe document. Real implementation will have one set of canonical ids per mounted dialog instance.
