---
title: >-
  Dark-mode contrast fixes + text-[11px] type-scale enforcement — lift specific
  stone-token combinations, add semibold or scale up every 11px user-facing copy
type: design
closes:
  - FB-105
  - FB-106
  - FB-109
depends_on: []
inputs:
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/keyboard-shortcut-map.html
  - stages/design/artifacts/feedback-lifecycle-transitions.html
  - stages/design/artifacts/review-package-structure.html
outputs:
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/keyboard-shortcut-map.html
  - stages/design/artifacts/feedback-lifecycle-transitions.html
  - stages/design/artifacts/review-package-structure.html
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/artifacts/unit-31-design-review.md
quality_gates:
  - >-
    `assessor-summary-card.html` dark-mode contrast fixes land. (a) Line 78
    "already-closed (prior visit)" bullet: outer span lifted from
    `text-stone-500` to `text-stone-400`; inner `font-mono text-xs text-stone-600`
    lifted to `text-stone-300`. Post-fix contrast on forced-dark `bg-stone-900`
    is ≥ 7:1 (outer) / ≥ 10:1 (inner). (b) Lines 73, 160, 232 bare
    `text-stone-400` swapped to the canonical pair `text-stone-600
    dark:text-stone-300` so the component is safe to render in either color
    scheme. (c) `grep -nE 'text-stone-500|text-stone-600'
    stages/design/artifacts/assessor-summary-card.html` shows no bare
    `text-stone-500`/`text-stone-600` in the header bullet, subagent-timeout
    error text, or per-item bullet list — each carries the `dark:` companion.
  - >-
    `annotation-popover-states.html:381` popover close ✕ button passes WCAG
    1.4.3 in dark mode. (a) Default color rewritten from `text-stone-500` to
    the pair `text-stone-500 dark:text-stone-400`. (b) Size lifted from
    `text-sm` to `text-base` OR `font-semibold` added to preserve glyph
    legibility at sub-pixel densities. (c) Hover state preserves the existing
    `dark:hover:text-stone-200`; default state in dark now reaches ≥ 7:1
    (`text-stone-400` #a8a29e on `dark:bg-stone-800` #292524 = 7.1:1). (d)
    Manual walk confirms the ✕ remains clearly visible on `dark:bg-stone-800`
    and `dark:bg-stone-900` surfaces.
  - >-
    `text-[11px]` type-scale floor enforced stage-wide. Per-instance
    remediation per FB-105: (a) `review-ui-mockup.html:43` session-id span
    lifted to `text-xs font-mono` (drop `text-[11px]`; keep font-mono for
    the session-id monospace effect). (b) `review-ui-mockup.html:146` + `:163`
    "Operations" / "Security" stage labels lifted from `text-[11px] font-medium`
    to `text-xs font-semibold`. (c) `review-ui-mockup.html:802` feedback-body
    preview lifted from `text-[11px] text-stone-500` to `text-xs text-stone-600
    dark:text-stone-300` (also closes the sub-AA contrast on white). (d)
    `review-ui-mockup.html:1019` lifted to `text-xs font-mono`. (e)
    `review-ui-mockup.html:1285` lifted to `text-xs`. (f) `review-ui-mockup.html:1496,
    1532, 1568` "+ N more…" buttons lifted from `text-[11px] font-medium` to
    `text-xs font-semibold` (or kept at `text-[11px] font-semibold` if the
    layout requires the tighter size — both satisfy the §3 rule). (g)
    `keyboard-shortcut-map.html:546` footer lifted to `text-xs`; (h)
    `keyboard-shortcut-map.html:635` footer lifted to `text-xs`. (i)
    `feedback-lifecycle-transitions.html:226` lifted to `text-xs italic` (12px
    italic is above the legibility threshold without a weight bump). (j)
    `focus-ring-spec.html:108` — already covered by **unit-29** (lifted to
    `text-xs`); this unit does not re-touch it. (k)
    `review-package-structure.html:545, 666, 697, 725, 767, 805, 839, 870`
    eight code-block rows either lifted from `text-[11px]` to `text-xs font-mono`
    OR paired with `font-semibold` (designer's call per readability of each
    specific block; mixing is fine as long as the §3 rule — every `text-[11px]`
    pairs with `font-semibold` or `font-bold` — holds). (l)
    `review-package-structure.html:802` lifted to `text-xs`. (m) Stage-wide
    grep gate: `grep -rEn 'text-\[11px\]' stages/design/artifacts/` — every
    surviving hit must pair with `font-semibold` or `font-bold` on the same
    element. No `text-[11px] font-medium`, no `text-[11px]` bare, no
    `text-[11px] font-mono` standalone. A one-liner script formalizes the
    check: `for m in $(grep -rEn 'text-\[11px\]' stages/design/artifacts/ | cut
    -d: -f1-2); do file=$(echo $m | cut -d: -f1); line=$(echo $m | cut -d: -f2);
    weight=$(sed -n "${line}p" $file | grep -cE 'font-semibold|font-bold'); if
    [ "$weight" -eq 0 ]; then echo "MISSING WEIGHT: $m"; fi; done` → empty
    output.
  - >-
    `contrast-and-type-audit.md §3 Type Scale` verification section rewritten
    so the "`text-[11px]` instances are ALL paired with `font-semibold` or
    `font-bold`" claim is accompanied by the one-liner audit script above as
    canonical proof. Audit row(s) for each artifact touched in this unit are
    updated to reflect the actual post-fix class strings (no stale "was
    text-[11px]" rows claiming a fix that didn't land).
  - >-
    feedback-assessor re-runs the FB-105 / FB-106 / FB-109 per-line grep
    recipes and confirms each call-out line now uses the remediated class
    string. Assessor also runs the §3 one-liner audit script and confirms
    empty output.
status: pending
---
# Contrast + type-scale specific fixes

## Scope

Three iteration-4 findings that span specific rendering failures
rather than canonical-token drift:

- **FB-105** · `text-[11px]` without `font-semibold/bold` across
  five artifacts (review-ui-mockup, keyboard-shortcut-map,
  feedback-lifecycle-transitions, focus-ring-spec, review-package-
  structure) — violates the §3 type-scale floor and drops legibility
  at Zoom 200% per WCAG 1.4.4.
- **FB-106** · `assessor-summary-card.html` dark-mode contrast hot
  spots — line 78 has a nested `text-stone-600 on bg-stone-900` at
  2.56:1 (body-text FAIL); lines 73, 160, 232 use bare
  `text-stone-400` that will fail if the forced `class="dark"` is
  ever removed.
- **FB-109** · `annotation-popover-states.html:381` popover close
  ✕ default color `text-stone-500` on `dark:bg-stone-800` is
  3.17:1 — FAIL 1.4.3 treating the glyph as text.

## Approach

Designer hat:

1. **FB-106 fixes** — direct class-string edits at
   `assessor-summary-card.html:78, 73, 160, 232`. Each affected line
   swaps bare `text-stone-500`/`text-stone-400`/`text-stone-600`
   for the canonical pair that pairs `stone-N` (light) with
   `stone-(10-N)` (dark).
2. **FB-109 fix** — add `dark:text-stone-400` to the
   `:381` close button and lift from `text-sm` to `text-base`
   (or add `font-semibold`). The pair now reaches 7.1:1 on
   `dark:bg-stone-800`.
3. **FB-105 per-instance sweep** — per-line rewrite across the
   five named artifacts. Prefer lifting to `text-xs` (removes the
   11px-specific weight requirement) for user-facing copy;
   reserve `text-[11px] font-semibold` for tight-metric code
   labels where the 12px size would break layout.
4. **Audit update** — rewrite
   `contrast-and-type-audit.md §3` verification section so the
   "all 11px has semibold" claim now carries the canonical
   one-liner audit script as proof.

Design-reviewer hat:

1. Run the one-liner `text-[11px]`-without-weight audit script;
   confirm empty output.
2. Manually walk each `.stage-btn` hover + focus state and
   confirm the Operations/Security labels + session-id +
   feedback-body preview are legible post-fix.
3. Verify the popover close ✕ is visible on
   `dark:bg-stone-800` and `dark:bg-stone-900` surfaces.

Feedback-assessor hat:

1. Run each feedback body's literal grep recipe.
2. Run the §3 one-liner script.
3. Confirm FB-105, FB-106, FB-109 close.

## Out of scope

- `focus-ring-spec.html:108` type-scale overlap — handled by
  **unit-29** (same fix, different unit for scope coherence).
- Opacity-ban artifact remediation — **unit-26**.
- Spec/prose alignment with ban — **unit-27**.
- Canonical-pair token sweep — **unit-28**.
- Focus-visible canonicalization — **unit-29**.
- Native activation + live regions — **unit-30**.

## Completion criteria

- [ ] `assessor-summary-card.html:78` outer span lifted to `text-stone-400`, inner lifted to `text-stone-300`
- [ ] `assessor-summary-card.html:73, 160, 232` bare stone classes paired with `dark:` companions
- [ ] `annotation-popover-states.html:381` close ✕ gains `dark:text-stone-400` and lifts size/weight
- [ ] Every `text-[11px]` across the five affected artifacts pairs with `font-semibold`/`font-bold` or lifts to `text-xs`
- [ ] `contrast-and-type-audit.md §3` verification carries the one-liner audit script as canonical proof
- [ ] Feedback-assessor confirms FB-105, FB-106, FB-109
