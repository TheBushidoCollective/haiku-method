---
title: >-
  revisit-modal-states.html has zero dialog/aria-modal/labelledby markup —
  violates aria-landmark-spec §3
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:56:54Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

`aria-landmark-spec.md §3` mandates that every modal carry `role="dialog" aria-modal="true" aria-labelledby="…"` and be wrapped in a focus trap. The `revisit-modal-states.html` artifact — the "interactive states" companion that enumerates every modal state (default, hover, focus, active, disabled, loading, error, empty) — ships **0** occurrences of `role="dialog"`, `aria-modal`, or `aria-labelledby`. Verification:

```
grep -cE 'role="dialog"|aria-modal|aria-labelledby' stages/design/artifacts/revisit-modal-states.html
→ 0
```

For comparison, the sibling `revisit-modal-spec.html` has ≥ 9 `role="dialog"` occurrences (one per variant). The states-coverage artifact either needs to render the same contract per state or the dev stage will ship modals that look like the design but have no dialog semantics.

**Why this matters beyond "lint":** `revisit-modal-states.html` IS the state-coverage-grid reference for the revisit modal. Dev stage will wire the React component against this file. Without dialog semantics in the reference:
- Screen-reader users never enter "dialog mode" — they hear the underlying page content bleed through.
- `Escape` handling has no anchor element carrying the dialog role for `focus-trap-react` to bind to.
- The focus-return-on-close contract can't be tested against this artifact.

The artifact also contains modal-shell containers (the "compact default", "loading state", "error state" cards) but wraps none of those in a dialog landmark. The line 407 rollback toast correctly has `role="status" aria-live="polite"` (appropriate for a toast), but the modal containers themselves (modal wrapper divs around lines 92–110, 440–480, etc.) are plain `<div>`s.

**Fix:** Every modal-shell `<div>` in `revisit-modal-states.html` must render as `<div role="dialog" aria-modal="true" aria-labelledby="{unique-id}">` with a visible heading carrying that id. Add the landmark-spec §9 checklist grep to the unit-19 completion criteria so the states file is held to the same bar as the spec file.
