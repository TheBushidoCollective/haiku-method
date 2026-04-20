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
depends_on:
  - unit-27-palette-and-sizing-magic-number-normalization
inputs:
  - stages/design/artifacts/
  - stages/design/DESIGN-BRIEF.md
outputs:
  - stages/design/artifacts/annotation-gesture-spec.html
  - stages/design/artifacts/feedback-lifecycle-transitions.html
  - stages/design/artifacts/focus-ring-spec.html
  - stages/design/artifacts/keyboard-shortcut-map.html
  - stages/design/artifacts/review-package-structure.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/rollback-reason-banner.html
  - stages/design/artifacts/skip-link-spec.html
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/unit-28-design-review.md
quality_gates:
  - name: stagewide-text-11px-paired-with-semibold
    command: "! grep -rEn 'text-\\[11px\\]' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/ --include='*.html' | grep -vE 'font-semibold|font-bold'"
  - name: design-brief-typography-floor-rule-documented
    command: "grep -E 'text-\\[11px\\].*font-semibold|Typography Floor' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/DESIGN-BRIEF.md"
  - name: audit-cites-typography-grep
    command: "grep -E 'text-\\[11px\\]' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/contrast-and-type-audit.md"
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
