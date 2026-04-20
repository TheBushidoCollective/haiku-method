---
title: >-
  Native keyboard activation + live-region landmarks — convert
  `<div role="link">` stage strip to native elements, wire canonical live-region
  pair on every page-level artifact
type: design
closes:
  - FB-103
  - FB-104
depends_on:
  - unit-29-focus-visible-canonicalization-and-spec-clarity
inputs:
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/aria-landmark-spec.md
  - stages/design/artifacts/aria-live-sequencing-spec.md
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/comment-to-feedback-flow.html
  - stages/design/artifacts/revisit-unit-list.html
outputs:
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/comment-to-feedback-flow.html
  - stages/design/artifacts/revisit-unit-list.html
  - stages/design/artifacts/aria-landmark-spec.md
  - stages/design/artifacts/aria-live-sequencing-spec.md
  - stages/design/artifacts/unit-30-design-review.md
quality_gates:
  - >-
    `stage-progress-strip.html` per-stage link nodes converted from
    `<div role="link">` to native `<a href="#stage-N" data-stage="N">` (the
    user-directed option from FB-103). Every `<div role="link">` at lines 91,
    105, 119, 137, 151, 190, 200, 215, 229, 242 (and any further occurrences
    down-file) is rewritten; `role="link"` is removed entirely (the native
    `<a>` carries implicit link semantics). Behavior equivalence: (a) each
    anchor receives focus via Tab per the existing roving-tabindex JS
    (retaining `tabindex` semantics on the native element); (b) Enter
    activation is provided by the browser's native anchor click — no custom
    keydown handler is needed for Enter; (c) the existing arrow-key handler
    at lines 403–438 continues to manage focus movement and is retrained to
    use the native anchor nodes. The §Pseudocode block at 400–447 and the
    spec table at 380–385 are updated to reflect native-element semantics
    (the "Enter / Space activates the focused stage" row is unchanged because
    the browser already provides Enter activation on `<a>`; Space is not a
    default anchor activation key but is preserved by the arrow-key handler's
    fallback, which is documented in the pseudocode). (a) `grep -nE 'role="link"'
    stages/design/artifacts/stage-progress-strip.html` returns 0 hits. (b)
    `grep -cE '<a href="#stage-' stages/design/artifacts/stage-progress-strip.html`
    returns ≥ 10 hits (one per stage node). (c) Manual keyboard walk
    confirms Tab → arrow → Enter navigates and activates each stage.
  - >-
    Canonical live-region landmark pair added to every page-level artifact
    identified in `aria-landmark-spec.md §2` that currently lacks it. (a)
    `revisit-modal-states.html` — both `<div id="feedback-live-polite" role="status"
    aria-live="polite" aria-atomic="true" class="sr-only"></div>` and `<div
    id="feedback-live-assertive" role="alert" aria-live="assertive"
    aria-atomic="true" class="sr-only"></div>` added at body level. Existing
    inline `role="alert"` at line 453 and inline `role="status"` at line 497
    are kept as per-toast regions (they remain the actual render targets for
    error banners and rollback toasts), but the canonical page-level pair is
    now also present and wired to the `announce(regionId, message)` helper
    from `aria-live-sequencing-spec.md §2.2`. (b) `comment-to-feedback-flow.html`
    — existing polite region at :1225 is kept; the missing assertive
    counterpart is added adjacent. (c) `revisit-unit-list.html` — both polite
    + assertive regions added at body level (neither currently exists).
    Verification greps (each must return ≥ 1): `grep -c 'id="feedback-live-polite"'
    stages/design/artifacts/revisit-modal-states.html`; `grep -c
    'id="feedback-live-assertive"' stages/design/artifacts/revisit-modal-states.html`;
    `grep -c 'id="feedback-live-assertive"'
    stages/design/artifacts/comment-to-feedback-flow.html`; `grep -c
    'id="feedback-live-polite"' stages/design/artifacts/revisit-unit-list.html`;
    `grep -c 'id="feedback-live-assertive"' stages/design/artifacts/revisit-unit-list.html`.
  - >-
    Any JS in the affected artifacts that announces a status message is
    rewritten (or stubbed in the artifact's script block) to call
    `announce('feedback-live-polite', ...)` / `announce('feedback-live-assertive', ...)`
    rather than mutating inline toast text directly. The `announce()` helper
    signature and debounce contract already exists in
    `aria-live-sequencing-spec.md §2.2`; each artifact's script references
    that spec in a top-of-file comment.
  - >-
    Structural verification replaces screen-reader walk (closes FB-115).
    Design-reviewer runs the following executable checks on
    `stage-progress-strip.html` and confirms each: (a) `grep -cE
    '<a href="#stage-[0-9]+"[^>]*data-stage='
    stages/design/artifacts/stage-progress-strip.html` returns ≥ 10 (one
    per stage anchor). (b) `grep -cE 'role="link"'
    stages/design/artifacts/stage-progress-strip.html` returns 0. (c) The
    arrow-key handler query selector is updated to target the new anchors:
    `grep -nE 'querySelectorAll\("a\[data-stage\]"\)|\[data-stage\]'
    stages/design/artifacts/stage-progress-strip.html` returns ≥ 1 match
    inside the keydown handler. (d) The spec row at 380–385 still lists
    "Enter / Space activates the focused stage" and the pseudocode at
    400–447 documents that Enter is native for `<a>` (no custom handler
    needed); `grep -nE 'Enter is native|native anchor activation'
    stages/design/artifacts/stage-progress-strip.html` returns ≥ 1. The
    feedback-assessor runs these greps directly; no manual screen-reader
    walk is required to close FB-103.
  - >-
    announce() wiring verification (closes FB-116). Each of
    `revisit-modal-states.html`, `comment-to-feedback-flow.html`,
    `revisit-unit-list.html` contains at least one call to
    `announce('feedback-live-polite', …)` and at least one call to
    `announce('feedback-live-assertive', …)` inside its `<script>` block,
    wired to the shared helper documented in `aria-live-sequencing-spec.md
    §2.2`. Greps (each must return ≥ 1): `grep -c
    "announce\('feedback-live-polite'"
    stages/design/artifacts/revisit-modal-states.html`; `grep -c
    "announce\('feedback-live-assertive'"
    stages/design/artifacts/revisit-modal-states.html`; and the same two
    greps against `comment-to-feedback-flow.html` and `revisit-unit-list.html`.
    A top-of-file inline `<script>`-block comment cross-references the
    helper: `// announce() helper contract: see aria-live-sequencing-spec.md
    §2.2`. Cross-ref grep: `grep -c 'aria-live-sequencing-spec.md §2.2'
    stages/design/artifacts/revisit-modal-states.html
    stages/design/artifacts/comment-to-feedback-flow.html
    stages/design/artifacts/revisit-unit-list.html` returns ≥ 3 (closes
    FB-131).
  - >-
    aria-*.md coverage updates (closes FB-121). Because this unit's edits
    touch `aria-landmark-spec.md` (new coverage rows for the three newly-
    wired artifacts' page-level regions) and `aria-live-sequencing-spec.md`
    (reference to the now-wired announce() call-sites), both files appear
    in this unit's `outputs:` list (not just `inputs:`). Specifically: (a)
    `aria-landmark-spec.md §2` coverage table gains a "✓ canonical live-
    region pair" entry for each of `revisit-modal-states.html`,
    `comment-to-feedback-flow.html`, `revisit-unit-list.html`; `grep -cE
    'revisit-modal-states.html.*live-region|live-region.*revisit-modal-states'
    stages/design/artifacts/aria-landmark-spec.md` returns ≥ 1 (and same
    for the other two artifacts). (b) `aria-live-sequencing-spec.md` adds
    a §N "Canonical call-sites" subsection listing the three artifacts now
    wired to `announce()`; `grep -cE 'Canonical call-sites'
    stages/design/artifacts/aria-live-sequencing-spec.md` returns ≥ 1.
  - >-
    Anchor state-coverage matrix (closes FB-128). When `<div role="link">`
    converts to native `<a>`, the post-fix anchor must carry class strings
    for every interactive state: default, hover, focus-visible, active
    (current stage), visited is treated the same as default (no separate
    styling — URLs point at same-page anchors), disabled is represented
    via `aria-disabled="true"` + pointer-events guard. Verification greps:
    (a) `grep -cE '<a[^>]*href="#stage-[^"]+"[^>]*class="[^"]*hover:'
    stages/design/artifacts/stage-progress-strip.html` returns ≥ 10. (b)
    `grep -cE '<a[^>]*href="#stage-[^"]+"[^>]*class="[^"]*focus-visible:'
    stages/design/artifacts/stage-progress-strip.html` returns ≥ 10. (c)
    `grep -cE 'aria-current="(page|step)"'
    stages/design/artifacts/stage-progress-strip.html` returns ≥ 1 (for
    the active stage). (d) A §N "State coverage" section inside the
    artifact documents each state's canonical class string; grep for the
    section header: `grep -c 'State coverage (FB-128)'
    stages/design/artifacts/stage-progress-strip.html` returns 1. Sibling
    serialization: this unit's `depends_on: [unit-29]` ensures unit-29's
    focus-visible sweep completes before this unit rewrites the anchors;
    unit-28's gray→stone sweep also completes first because unit-29 chains
    back through unit-26 → unit-28 → unit-27.
  - >-
    Sibling write serialization on shared artifacts (closes FB-122).
    `revisit-unit-list.html` is written by unit-26 (opacity ban) and this
    unit (live-region pair); `revisit-modal-states.html` is written by
    unit-27 (prose ban) and this unit (live-region pair). Because this
    unit's `depends_on: [unit-29]` chains through unit-26 → unit-28 →
    unit-27, both of those units complete before this unit runs. The edits
    are additive (unit-26/unit-27 modify existing elements; this unit
    adds new elements at body level), so no conflict arises at merge. A
    post-execute grep confirms both earlier units' contributions survived
    this unit's write: `grep -c 'opacity-60'
    stages/design/artifacts/revisit-unit-list.html` returns 0 (unit-26 fix
    held); `grep -c 'disabled:opacity-50'
    stages/design/artifacts/revisit-modal-states.html` returns 0 (unit-27
    fix held); AND `grep -c 'id="feedback-live-polite"'
    stages/design/artifacts/revisit-unit-list.html
    stages/design/artifacts/revisit-modal-states.html` returns ≥ 2 (this
    unit's addition landed).
  - >-
    feedback-assessor re-runs FB-103, FB-104, FB-115, FB-116, FB-121,
    FB-122, FB-128, FB-131 against the literal grep recipes above and
    confirms each passes (0 hits for negative greps; ≥ 1 for positive
    greps). Assessor additionally confirms the native-anchor path
    preserves all behavior the old `<div role="link">` pseudocode claimed
    (focus, arrow, Enter) via the structural greps — no manual screen-
    reader walk is required.
status: pending
---
# Native keyboard activation + live-region landmarks

## Scope

Two distinct accessibility defects with a common theme — "ARIA
patterns that require you to reimplement browser-native behavior
and got the implementation wrong":

- **FB-103** · `stage-progress-strip.html` uses `<div role="link">`
  nodes with no Enter / Space activation handler. The browser
  fires no default activation event on non-native elements, so
  keyboard users cannot activate a stage. Per user direction, the
  fix is to convert each `<div role="link">` to a native `<a
  href="#stage-N">` (eliminates the entire category of bug by
  using the element the browser already handles correctly).
- **FB-104** · `revisit-modal-states.html`,
  `comment-to-feedback-flow.html`, `revisit-unit-list.html` are
  missing (or partially missing) the canonical page-level
  live-region pair from `aria-live-sequencing-spec.md §2`.
  Screen-reader users lose status announcements on the failure
  path (e.g. "Revisit failed" assertive messages when only a
  polite region exists), which is a WCAG 4.1.3 Status Messages
  failure.

## Approach

Designer hat:

1. **Stage-progress-strip conversion (FB-103)** —
   rewrite each `<div role="link">` at the lines called out in the
   feedback body (91, 105, 119, 137, 151, 190, 200, 215, 229, 242)
   to `<a href="#stage-N" data-stage="N">`. Drop `role="link"`
   entirely. Preserve every existing class, `tabindex`,
   `aria-current`, `aria-describedby`. Retrain the arrow-key
   handler at 403–438 to operate on `nodeList.querySelectorAll('a[data-stage]')`
   rather than `[role="link"]`. Update the pseudocode + docs at
   380–385 / 400–447 to reflect native semantics (Enter is native;
   Space fallback remains in the keydown handler).
2. **Live-region pairs (FB-104)** — for each of the three
   artifacts, add the canonical pair at body level (inside the
   outermost `<body>` or after the skip-link, per the landmark
   spec). Wire each artifact's existing announcement path (e.g.
   `revisit-modal-states.html`'s rollback toast, `comment-to-feedback-flow.html`'s
   migrated-FB notification, `revisit-unit-list.html`'s revisit-confirmed
   toast) to call `announce('feedback-live-polite', ...)` /
   `announce('feedback-live-assertive', ...)` from the shared
   helper.

Design-reviewer hat:

1. Screen-reader walk of the rewritten `stage-progress-strip.html`
   — confirm each anchor is announced as "link, Stage N" and
   activates on Enter.
2. Manual verification that the canonical pair is present (not
   just the inline per-toast regions) in all three artifacts.
3. Confirm the artifacts' `<script>` blocks reference the shared
   `announce()` helper path rather than mutating toast text
   in-place.

Feedback-assessor hat:

1. Run the FB-103 `role="link"` grep.
2. Run the five FB-104 `id=` greps.
3. Confirm FB-103 and FB-104 close.

## Out of scope

- Focus-visible rings on the `.stage-btn` in `review-ui-mockup.html`
  — handled by **unit-29**.
- Other landmark/semantic fixes outside the three named artifacts
  — already covered by completed unit-13 + unit-22 + unit-24.

## Completion criteria

- [ ] `stage-progress-strip.html` converted to native `<a>` per stage; `role="link"` deleted
- [ ] Arrow-key handler + pseudocode updated to reflect native semantics
- [ ] `revisit-modal-states.html` carries canonical live-region pair at body level
- [ ] `comment-to-feedback-flow.html` gains missing assertive region
- [ ] `revisit-unit-list.html` carries canonical live-region pair at body level
- [ ] Artifact `<script>` blocks wire announcements to the shared `announce()` helper
- [ ] Feedback-assessor confirms FB-103, FB-104
