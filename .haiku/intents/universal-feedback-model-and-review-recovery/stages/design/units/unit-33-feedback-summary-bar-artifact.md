---
title: >-
  Produce feedback-summary-bar.html — the missing state-coverage artifact for
  FeedbackSummaryBar. DESIGN-BRIEF §2 and state-coverage-grid §7.6 name the
  component and declare its 6-state grid, but no rendered artifact exists.
  Dev stage has nothing to verify against at design-review time
type: design
closes:
  - FB-149
depends_on:
  - unit-26-artifact-opacity-and-banned-pair-sweep
  - unit-27-palette-and-sizing-magic-number-normalization
  - unit-28-typography-floor-pairing-sweep
  - unit-30-feedback-inline-mobile-reduced-motion-guard
  - unit-32-component-inventory-and-canonical-names
inputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/feedback-inline-desktop.html
outputs:
  - stages/design/artifacts/feedback-summary-bar.html
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/unit-33-design-review.md
quality_gates:
  - name: feedback-summary-bar-file-exists
    command: "test -f .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-summary-bar.html"
  - name: feedback-summary-bar-references-component
    command: "grep -c 'FeedbackSummaryBar' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-summary-bar.html"
  - name: feedback-summary-bar-uses-max-w-page
    command: "grep -E 'max-w-page' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-summary-bar.html"
  - name: feedback-summary-bar-no-gray-palette
    command: "! grep -E 'gray-[0-9]+' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-summary-bar.html"
  - name: feedback-summary-bar-no-banned-opacity
    command: "! grep -E 'opacity-(50|60)' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-summary-bar.html | grep -vE 'backdrop-blur|demo-only'"
  - name: feedback-summary-bar-no-bare-rounded
    command: "! grep -E 'class=\"[^\"]*\\brounded\\b[^-]' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-summary-bar.html"
  - name: feedback-summary-bar-typography-floor
    command: "! grep -E 'text-\\[11px\\]' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-summary-bar.html | grep -vE 'font-semibold|font-bold'"
  - name: feedback-summary-bar-has-reduced-motion-guard
    command: "bash -c 'f=.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-summary-bar.html; anim=$(grep -cE \"@keyframes|animation:|animate-\" \"$f\"); if [ \"$anim\" -gt 0 ]; then grep -cE \"prefers-reduced-motion\" \"$f\"; else exit 0; fi'"
  - name: feedback-summary-bar-has-6-state-labels
    command: "python3 -c \"import sys; c = open('.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/feedback-summary-bar.html').read().lower(); states = ['default', 'hover', 'focus', 'active', 'disabled', 'error']; missing = [s for s in states if s not in c]; sys.exit(1 if missing else 0)\""
  - name: state-coverage-grid-cites-summary-bar-artifact
    command: "grep -E 'feedback-summary-bar\\.html' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/state-coverage-grid.md"
---
# FeedbackSummaryBar state-coverage artifact

## Scope

**FB-149** — DESIGN-BRIEF §2 state-coverage requirement: "Every new
component in this intent ... MUST ship with a six-state grid (default /
hover / focus / active / disabled / error) **rendered alongside its
component spec**." DESIGN-BRIEF §2 "FeedbackSummaryBar" block (L319-336)
gives a textual spec but no visual rendering.

Every sibling §2 component has a rendered artifact:
- `FeedbackStatusBadge` → feedback-card-states.html (4 status swatches).
- `FeedbackOriginIcon` → feedback-inline-desktop.html / mobile (6 swatches).
- `FeedbackItem` → feedback-card-states.html (compact + expanded).
- `FeedbackList` → feedback-inline-desktop.html + comments-list-with-
  agent-toggle.html.
- `AgentFeedbackToggle` → agent-feedback-toggle-spec.html.
- `FeedbackSheet` → feedback-inline-mobile.html.
- `FeedbackFloatingButton` → feedback-inline-mobile.html.
- `AssessorSummaryCard` → assessor-summary-card.html.
- `StageProgressStrip` → stage-progress-strip.html.
- `RevisitModal` → revisit-modal-spec.html + revisit-modal-states.html.

`FeedbackSummaryBar` is the only §2 component without a rendered artifact.
The state-coverage-grid §7.6 row is verifiable only in prose — dev stage
cannot compare its implementation against a visual reference.

## Approach

**Designer hat:**

1. Author `stages/design/artifacts/feedback-summary-bar.html` following the
   artifact conventions used by `feedback-card-states.html` and
   `agent-feedback-toggle-spec.html`:
   - HTML5 `<!DOCTYPE>` with Tailwind via CDN or stage-standard link.
   - `<head>` includes `prefers-reduced-motion` guard block (unit-30's
     canonical).
   - `<body>` wraps content in `max-w-page mx-auto px-4 py-8`.
   - 3-row × 6-col matrix rendering each state:
     - Row 1 (populated counts): pending (amber badge "3 pending") /
       addressed (stone "2 addressed") / closed (teal "5 closed"). Three
       canonical count combinations (all-pending / mixed / all-closed).
     - Row 2 (interactive): hover (mouseover highlight) / focus (teal
       focus-visible ring) / active (pressed state).
     - Row 3 (degraded): disabled (no data — ghost placeholder at
       muted-surface tokens, NOT opacity) / error (API fail → bar hidden
       per §7.6 rationale, replaced with the small fallback message
       "Summary unavailable — refresh to retry").
2. Each row labeled with `<h2 class="text-sm font-semibold text-stone-700
   dark:text-stone-300 mb-2">` so the spec is self-documenting.
3. No `opacity-*` patterns on text-carrying surfaces. No raw-px sizing
   magic numbers — reference DESIGN-TOKENS §1.6 (unit-27) or use Tailwind
   scale. No `gray-*` palette. No bare `rounded`. Typography floor
   observed. This file is born compliant with every unit-26 / unit-27 /
   unit-28 gate.
4. `state-coverage-grid.md §0 checklist` and `§7.6` rows updated to cite
   `feedback-summary-bar.html` as the rendered artifact.

**Design-reviewer hat:**

- Run every stage quality gate (opacity / palette / radii / magic-number
  sizing / typography floor / reduced-motion guard) against the new file.
  Each must pass.
- Walk the 6 states visually — each must be distinguishable and match the
  component-inventory row for FeedbackSummaryBar.
- Confirm `state-coverage-grid.md §0` row count unchanged (15) and §7.6
  row cites the artifact.

**Feedback-assessor hat:**

- Confirm file exists via `ls`.
- Confirm all stage gates pass on the new file.
- FB-149 closes on file-exists + gate-pass verification.

## Completion criteria

- [ ] feedback-summary-bar.html authored
- [ ] 6 states rendered across a 3-row × 6-col matrix
- [ ] File passes all stage quality gates (opacity / palette / radii /
      sizing / typography / reduced-motion)
- [ ] state-coverage-grid §0 + §7.6 cite the artifact
- [ ] FB-149 closes on file-exists + gate-pass verification
