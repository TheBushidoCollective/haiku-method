---
title: >-
  Typography floor stage-wide sweep — every `text-[11px]` class either pairs
  with `font-semibold` / `font-bold` or lifts to `text-xs`. Eight artifacts
  currently violate the §2 Typography Floor rule; contrast-and-type-audit §3
  prose claims the rule is enforced but 40+ sites still ship the banned
  combination
type: design
closes:
  - FB-138
depends_on: []
inputs:
  - stages/design/artifacts/annotation-gesture-spec.html
  - stages/design/artifacts/feedback-lifecycle-transitions.html
  - stages/design/artifacts/focus-ring-spec.html
  - stages/design/artifacts/keyboard-shortcut-map.html
  - stages/design/artifacts/review-package-structure.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/rollback-reason-banner.html
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/contrast-and-type-audit.md
outputs:
  - stages/design/artifacts/annotation-gesture-spec.html
  - stages/design/artifacts/feedback-lifecycle-transitions.html
  - stages/design/artifacts/focus-ring-spec.html
  - stages/design/artifacts/keyboard-shortcut-map.html
  - stages/design/artifacts/review-package-structure.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/rollback-reason-banner.html
  - stages/design/artifacts/unit-28-design-review.md
quality_gates:
  - >-
    Stage-wide typography-floor gate: `grep -rEn 'text-\[11px\]'
    stages/design/artifacts/*.html | grep -vE 'font-semibold|font-bold'` →
    0 hits on rendered markup. Every `text-[11px]` class is paired with
    `font-semibold` or `font-bold`; non-compliant sites either gain the
    `font-semibold`/`font-bold` pairing OR are lifted to `text-xs`
    (12px floor).
  - >-
    Per-artifact resolution plan verified:
    - `annotation-gesture-spec.html:111` — code pill `text-[11px]
      font-mono` → `text-[11px] font-mono font-semibold` (monospace family
      + semibold weight pairing).
    - `feedback-lifecycle-transitions.html:226` — italic prose `text-[11px]`
      → `text-xs italic` (12px floor preserves readability).
    - `focus-ring-spec.html:108` — bare `text-[11px]` prose → `text-xs`.
    - `keyboard-shortcut-map.html:546, 635` — footer text bare `text-
      [11px]` → `text-xs`.
    - `review-package-structure.html:545, 666, 697, 725, 767, 802, 805,
      839, 870` — 9 sites, bare or `font-mono`-only `text-[11px]` → either
      `text-[11px] font-mono font-semibold` (for monospace code pills) or
      `text-xs` (for prose).
    - `review-ui-mockup.html:43, 146, 163, 802, 1019, 1055, 1087, 1094,
      1102, 1285, 1332, 1496, 1532, 1568, 1696` — 15+ sites, each triaged
      to either the semibold pairing (code) or `text-xs` lift (prose).
    - `revisit-modal-states.html:49, 444, 506, 537, 547, 588, 634` —
      modal-states footer / inline code, triaged the same way.
    - `rollback-reason-banner.html:55, 60, 65, ...` — monospaced table
      cells `text-[11px] font-mono` → `text-[11px] font-mono font-semibold`.
  - >-
    `DESIGN-BRIEF.md §2 "Typography Floor"` carries a reference row citing
    the exact grep above as the canonical audit command, and marks the
    rule as `MUST pair text-[11px] with font-semibold or font-bold —
    alternatives: lift to text-xs; font-mono alone is NOT sufficient
    (family ≠ weight); font-medium is one notch too light; italic is
    orthogonal`.
  - >-
    `contrast-and-type-audit.md §3` prose updated: replace the "Remaining
    `text-[11px]` instances are ALL paired with `font-semibold` or
    `font-bold`" claim with the actual post-sweep count (which will be
    "all remaining 0 violations" after this unit lands) and cite the grep
    as the verification method, not prose inspection.
  - >-
    Typography-floor grep added to `design-reviewer.md` hat spec gate list
    alongside existing `text-\[9px\]` / `text-\[10px\]` bans so it runs on
    every future iteration.
---
# Typography floor stage-wide sweep

## Scope

**FB-138** — DESIGN-BRIEF §2 "Typography Floor" mandates: "`text-[11px]` is
permitted ONLY when paired with `font-semibold` or `font-bold`." The same
rule appears in `state-coverage-grid.md §3` and
`contrast-and-type-audit.md §3` prose claims the rule is enforced.

Live stage-wide grep `grep -rEn 'text-\[11px\]' stages/design/artifacts/*.html
| grep -vE 'font-semibold|font-bold'` returns 40+ violations across 8
artifacts where `text-[11px]` is paired with `font-medium`, `font-mono`,
`italic`, or no weight at all.

Why it matters:

- Visual weight — the `font-semibold` / `font-bold` requirement exists
  because the heavier stroke width compensates for the smaller glyph size.
  `font-mono` is a family (not a weight), `font-medium` is one notch too
  light, `italic` is orthogonal, and a bare class fails outright.
- Cross-artifact drift — `comments-list-with-agent-toggle.html` already
  uses `text-[11px] font-semibold` uniformly; the other 8 files don't.
- Accessibility — WCAG 1.4.4 Resize Text at 200% zoom fails on 11px
  regular-weight glyphs; the type audit calls this out explicitly.

## Approach

**Designer hat:**

1. For each of the 40+ sites, triage into one of two fix paths:
   - **Monospace / code context** — pair `font-mono` with `font-semibold`
     so the rule is satisfied (`text-[11px] font-mono font-semibold`).
     The `font-semibold` weight applied to the mono family still reads as
     the intended visual style; the rule's "font-mono is not sufficient"
     language refers to `font-mono` alone without a weight.
   - **Prose / callout / italic / bare** — lift to `text-xs` (12px floor).
     12px at regular weight reads comfortably without the weight pairing,
     so no `font-semibold` needed.
2. Apply the fix in-place per the file:line inventory in `quality_gates`.
3. Update `DESIGN-BRIEF.md §2 "Typography Floor"` rule row to cite the
   exact verification grep as the audit command, and enumerate the four
   non-compliant pairings that are banned (`font-medium`, `font-mono`
   alone, `italic` alone, no weight).
4. Update `contrast-and-type-audit.md §3` to replace the stale "all paired"
   claim with the post-sweep grep result + the grep command itself.

**Design-reviewer hat:**

- Run the verification grep against every affected file. Must return 0.
- Spot-check a sample of lifted `text-xs` sites — the visual weight should
  feel comparable to the pre-rewrite `text-[11px] font-medium` (not
  noticeably lighter than the surrounding text).
- Confirm the grep is added to the design-reviewer gate list for future
  iterations.

**Feedback-assessor hat:**

- Run the live grep (not audit-prose claim).
- FB-138 closes when the grep returns 0 across the 8 affected artifacts.

## Completion criteria

- [ ] Typography-floor grep returns 0 across all 8 affected artifacts
- [ ] Per-site triage applied correctly (monospace gets semibold pairing;
      prose gets `text-xs` lift)
- [ ] DESIGN-BRIEF.md §2 Typography Floor row cites the grep
- [ ] contrast-and-type-audit.md §3 prose updated with post-sweep reality
- [ ] Design-reviewer gate list includes the typography-floor grep
- [ ] FB-138 closes on live-grep verification
