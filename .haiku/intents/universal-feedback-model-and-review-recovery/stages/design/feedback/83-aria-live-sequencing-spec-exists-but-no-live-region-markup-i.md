---
title: >-
  aria-live sequencing spec exists but no live-region markup in
  feedback-card-states optimistic UI demo
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:59:39Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

`aria-live-sequencing-spec.md` defines a three-phase announcement template (pending → success | failure) using the polite region for "FB-XX marking as closed…" and the assertive region for rollback errors. `aria-landmark-spec.md §1` defines the two live-region elements (`#feedback-live-polite` role=status + `#feedback-live-assertive` role=alert). These are correctly wired into `feedback-inline-desktop.html:514-515` and `feedback-inline-mobile.html`.

**But:** `feedback-card-states.html`, which is the canonical reference for every card state (pending, closed, rejected, addressed, error-rollback), does NOT render the live-region elements and does NOT demonstrate the announcement sequencing. Verification:

```
grep -nE 'role="status"|role="alert"|aria-live' stages/design/artifacts/feedback-card-states.html
```

Returns only the `role="alert"` inside the demo cards themselves (for visual error styling), not the two persistent live regions. And the "optimistic UI" transitions demonstrated in the artifact (card flips from pending to closed via the Close button) have no accompanying SR announcement.

**Why this matters for dev hand-off:**

1. The dev stage will wire React components against `feedback-card-states.html` as the visual and behavioral reference. If the reference doesn't model the live-region announcement, dev will ship a UI that SILENTLY changes state for screen-reader users.

2. WCAG 4.1.3 Status Messages (Level AA) requires status changes be programmatically determined through role or properties. The design stage's output must carry the contract or the AA compliance will regress the moment dev implements it.

3. The live-region spec says two regions are required (polite + assertive, non-interchangeable, per `aria-landmark-spec.md §1 "Two live regions, not one"`). The card-states demo only visually shows the error chip, not the announcement split.

**Fix:**

1. Add the canonical live-region block to `feedback-card-states.html` at the bottom of `<body>`:
```html
<div id="feedback-live-polite" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>
<div id="feedback-live-assertive" role="alert" aria-live="assertive" aria-atomic="true" class="sr-only"></div>
```

2. On each card's interactive buttons (Close, Reject, Approve, Re-open), wire a demo-level JS hook that writes the three-phase sequence from `aria-live-sequencing-spec.md §2` into the appropriate region. Even a minimal `el.textContent = '…'` mutation is fine for the wireframe — the point is the dev stage inherits the contract.

3. Add a comment block at the top of `feedback-card-states.html` pointing at `aria-live-sequencing-spec.md` so the spec is discoverable alongside the visual reference.
