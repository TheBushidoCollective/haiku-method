---
title: >-
  revisit-modal-states.html + comment-to-feedback-flow.html missing canonical
  live-region landmark pair
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:29:39Z'
iteration: 4
visit: 4
source_ref: null
closed_by: unit-30-native-activation-and-live-region-landmarks
---

Per `aria-landmark-spec.md §1` (the canonical landmark map) and `aria-live-sequencing-spec.md §2` (two live regions, separate nodes), every page-level artifact MUST carry BOTH of these at the body level:

```html
<div id="feedback-live-polite" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>
<div id="feedback-live-assertive" role="alert" aria-live="assertive" aria-atomic="true" class="sr-only"></div>
```

**Files that have both (grep verified):** `feedback-inline-desktop.html` (L518-519), `feedback-inline-mobile.html` only.

**Files that are page-level per `aria-landmark-spec.md §2` but are missing the pair:**

- `revisit-modal-states.html` — no `#feedback-live-polite` / `#feedback-live-assertive` nodes. Has 1 inline `role="alert"` on an error banner at `:453` and 1 inline `role="status" aria-live="polite"` on a rollback toast at `:497`, but no canonical page-level pair. The sequencing spec (§2.2) requires a polite + assertive pair so that "marking…" polite messages aren't overwritten by assertive rollbacks mid-announcement. Inline toasts don't satisfy this contract — they aren't the same nodes, they aren't guaranteed to be present on every render path, and they aren't wired to the `announce()` helper.
- `comment-to-feedback-flow.html` — has 1 polite region at `:1225` (`<div role="status" aria-live="polite" class="sr-only"></div>`) but NO assertive counterpart. This is exactly the "single node" failure mode §2 warns against: the polite "migrated FB-N" announcement gets overwritten by an assertive "migration failed" message before the screen reader has spoken the first string.
- `revisit-unit-list.html` — has `<header role="banner">` and `<main id="main-content">` (it's a page-level artifact per `aria-landmark-spec.md §2` row), but has no live-region pair at all. Revisit-unit-list is the surface where "Unit created" / "Unit reset" / "Revisit confirmed" announcements fire; those need a polite region, and rollback messaging needs an assertive region.

**Why this matters:**

Screen-reader users rely on the two-region pattern to hear the in-flight message ("Revisiting stage…") AND the completion/error message ("Revisit complete" / "Revisit failed — stage stays open"). Without the assertive region, the failure path is silent to AT, which is a WCAG 4.1.3 Status Messages failure.

**Fix required:** Add the canonical pair to every page-level artifact the spec identifies. The `.sr-only` styling keeps them invisible to sighted users. Wire them to the same `announce(regionId, message)` helper so all three artifacts share the debounce-coalesce logic from `aria-live-sequencing-spec.md §2.2`.

**Verification grep (should each return ≥ 1):**

- `grep -c 'id="feedback-live-polite"' stages/design/artifacts/revisit-modal-states.html` → 0 (should be 1)
- `grep -c 'id="feedback-live-assertive"' stages/design/artifacts/revisit-modal-states.html` → 0 (should be 1)
- `grep -c 'id="feedback-live-assertive"' stages/design/artifacts/comment-to-feedback-flow.html` → 0 (should be 1)
- `grep -c 'id="feedback-live-polite"' stages/design/artifacts/revisit-unit-list.html` → 0 (should be 1)
- `grep -c 'id="feedback-live-assertive"' stages/design/artifacts/revisit-unit-list.html` → 0 (should be 1)

**WCAG refs:** 4.1.3 Status Messages (Level AA).
