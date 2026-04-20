---
title: >-
  Canonical-token normalization sweep — sidebar width, magic max-width,
  gray→stone, Re-open, tab color, bare rounded, component-name unification
type: design
closes:
  - FB-87
  - FB-88
  - FB-89
  - FB-90
  - FB-91
  - FB-96
  - FB-99
  - FB-101
depends_on: []
inputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/state-coverage-grid.md
  - knowledge/DESIGN-TOKENS.md
outputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/aria-landmark-spec.md
  - stages/design/artifacts/aria-live-sequencing-spec.md
  - knowledge/DESIGN-TOKENS.md
  - stages/design/artifacts/unit-28-design-review.md
quality_gates:
  - >-
    Sidebar-width canonical pair normalized to `w-80 xl:w-96` everywhere. (a)
    `DESIGN-BRIEF.md:38` rewritten from `w-80 lg:w-96 shrink-0 sticky top-16
    h-[calc(100vh-4rem)] flex-col` to `w-80 xl:w-96 shrink-0 sticky top-16
    h-[calc(100vh-4rem)] flex-col` (matches §4 line 666 and unit-16 gate 5). (b)
    `assessor-summary-card.html:302` "desktop (1280px) — sidebar `lg:w-96`"
    rewritten to `xl:w-96`. (c) Stage-wide: `grep -rEn 'lg:w-96'
    stages/design/ knowledge/DESIGN-TOKENS.md` returns 0 hits (all occurrences
    normalized). `grep -rEn 'xl:w-96' stages/design/ knowledge/DESIGN-TOKENS.md`
    returns ≥ 3 hits (DESIGN-BRIEF §2, DESIGN-BRIEF §4, assessor-summary-card).
  - >-
    Magic-number `max-w-[1400px]` removed from every artifact. (a)
    `assessor-summary-card.html:15` and `:24` rewritten to `max-w-page` (same
    utility used in `feedback-inline-desktop.html:105`). (b) DESIGN-TOKENS.md
    §1.3 gains a one-line note "`max-w-page` is the canonical page-width
    utility, backed by `--max-page-width` CSS variable; use in place of
    `max-w-[1400px]`" if the note is not already present. (c) Stage-wide:
    `grep -rn 'max-w-\[1400px\]' stages/design/artifacts/` returns 0 hits.
  - >-
    `gray-*` Tailwind classes replaced by `stone-*` equivalents at the same
    shade number in `stage-progress-strip.html`. Every occurrence at the 13
    lines called out in FB-89 (361, 362, 370×3, 372×3, 379×2, 391, 392, 399,
    400, 451, 452, 459, 460) is rewritten: `gray-900→stone-900`,
    `gray-100→stone-100`, `gray-500→stone-500`, `gray-400→stone-400`,
    `gray-200→stone-200`, `gray-700→stone-700`, `gray-800→stone-800`,
    `gray-50→stone-50`, `gray-300→stone-300`, `gray-950→stone-950`. (a) `grep
    -n 'gray-' stages/design/artifacts/stage-progress-strip.html` returns 0
    hits. (b) Stage-wide: `grep -rn 'gray-' stages/design/artifacts/ | grep -v
    '\.md:'` returns 0 hits — only server-rendered templates (outside
    `stages/design/artifacts/`) may use gray.
  - >-
    Hyphenated `Re-open` canonicalized to one-word `Reopen` in the audit. (a)
    `contrast-and-type-audit.md:255` and `:256` table rows rewritten from
    `"Re-open"` to `"Reopen"`. (b) Stage-wide scope (excluding feedback +
    unit docs that legitimately quote historical drift):
    `grep -rn 'Re-open' stages/design/artifacts/ stages/design/DESIGN-BRIEF.md
    knowledge/DESIGN-TOKENS.md | grep -v 'stages/design/feedback/' | grep -v
    'stages/design/units/'` returns 0 hits.
  - >-
    Tab active-state color normalized to teal per DESIGN-BRIEF §2 Component
    Patterns (`border-b-2 border-teal-600 text-teal-600 dark:border-teal-400
    dark:text-teal-400`). (a) `feedback-inline-desktop.html:113` tablist
    Overview/Units/Knowledge rewritten from blue to teal. (b)
    `feedback-inline-mobile.html:118` mobile tablist rewritten from blue to
    teal. (c) Any other `role="tab"` artifact that renders the active-tab
    treatment is also swept. (d) Grep gates: `grep -rEn 'border-blue-600
    text-blue-600|role="tab"[^>]*border-blue' stages/design/artifacts/`
    returns 0 hits; `grep -rEn 'border-teal-600 text-teal-600'
    stages/design/artifacts/` returns ≥ 2 hits (one per feedback-inline
    variant). Blue is preserved only in server-rendered template references
    and explicit `addressed` status rows per DESIGN-TOKENS §1.1 SSR
    subsection.
  - >-
    Component name unified on `FeedbackSheet` (Mobile prefix retired per
    DESIGN-BRIEF §2 Retired Components table). Every reference to
    `MobileFeedbackPanel` across the design stage rewritten to `FeedbackSheet`:
    (a) `DESIGN-BRIEF.md:119` — "FeedbackSheet (aka MobileFeedbackPanel)"
    collapses to `FeedbackSheet`; the `(aka MobileFeedbackPanel)` parenthetical
    is deleted. (b) `DESIGN-BRIEF.md:597` — Retired Components row collapses to
    a single canonical name; the retired name listed is
    `MobileFeedbackSheet` (the historically-retired prefix), not
    `MobileFeedbackPanel`. (c) `DESIGN-BRIEF.md:810` accessibility prose,
    `state-coverage-grid.md:22` + §7.8, `aria-landmark-spec.md`,
    `aria-live-sequencing-spec.md`, `unit-19-component-a11y-fixes.md` (frontmatter
    + body lines 62, 139, 163), `unit-22-review-notes.md:163` — each `MobileFeedbackPanel`
    rewritten to `FeedbackSheet`. **Important**: unit-19 and unit-22 are
    frozen completed units; this unit does NOT modify their frontmatter or
    body. Instead, the canonical-name change is recorded in a new section
    of `state-coverage-grid.md §0` ("Component-name canonical") that pins
    `FeedbackSheet` as the one live name and instructs reviewers to read
    past unit-19/unit-22 references to `MobileFeedbackPanel` as legacy.
    (d) Grep gate (excluding frozen unit docs): `grep -rn
    'MobileFeedbackPanel' stages/design/ knowledge/ | grep -v
    'stages/design/units/unit-19' | grep -v 'stages/design/units/unit-22' |
    grep -v 'stages/design/feedback/'` returns 0 hits.
  - >-
    Bare `rounded` class (no shade) replaced with explicit DESIGN-TOKENS §1.5
    tokens in `feedback-card-states.html`. (a) Status-pill spans in the
    status-transition matrix table (lines 58–67, 7 occurrences) rewritten from
    `rounded` to `rounded-full` (matches §1.5 badge/pin pattern). (b) Footer
    buttons at lines 95, 114, 132, 133, 151, 152, 171, 190, 210, 211 rewritten
    from `rounded` to `rounded-md` (DESIGN-TOKENS §1.5 secondary-button radius;
    consistent with the `text-[11px] font-semibold px-2 py-1` size class
    already on those buttons). (c) Stage-wide gate: `grep -rEn
    'class="[^"]*\brounded\b(?!-)' stages/design/artifacts/*.html` returns 0
    hits.
  - >-
    feedback-assessor re-runs each of FB-87, FB-88, FB-89, FB-90, FB-91, FB-96,
    FB-99, FB-101 against its literal grep recipe and confirms each returns 0
    hits.
status: pending
---
# Canonical-token normalization sweep

## Scope

Iteration-4 adversarial review found eight consistency defects
spread across DESIGN-BRIEF, assessor-summary-card, stage-progress-
strip, contrast-and-type-audit, feedback-inline-desktop / mobile,
feedback-card-states, and state-coverage-grid. Each is a canonical-
token or canonical-name violation that dev-stage React would copy
verbatim into component code if left unfixed:

- **FB-87 / FB-101** · Sidebar width — `lg:w-96` vs `xl:w-96`
- **FB-88** · Magic `max-w-[1400px]` → `max-w-page`
- **FB-89** · `gray-*` → `stone-*` in stage-progress-strip.html (13 occurrences)
- **FB-90** · "Re-open" → "Reopen" in contrast-and-type-audit.md
- **FB-91** · Tab active color blue → teal per DESIGN-BRIEF §2
- **FB-96** · Component name `MobileFeedbackPanel` → `FeedbackSheet`
- **FB-99** · Bare `rounded` (no shade) → explicit `rounded-full` / `rounded-md`

## Approach

Designer hat, per defect:

1. **Sidebar width (FB-87, FB-101)** — single-line edits to
   `DESIGN-BRIEF.md:38` and `assessor-summary-card.html:302`.
   Cross-check DESIGN-TOKENS.md §1.3 and §2.5 for any `lg:` holdout.
2. **Magic max-width (FB-88)** — rewrite the two lines in
   `assessor-summary-card.html`, add a one-line note to
   DESIGN-TOKENS.md §1.3 if the `max-w-page` utility isn't already
   documented.
3. **gray→stone (FB-89)** — mechanical sweep of the 13 lines in
   `stage-progress-strip.html`; preserve shade number on every
   rewrite.
4. **Re-open (FB-90)** — two-line edit to
   `contrast-and-type-audit.md`.
5. **Tab color (FB-91)** — class-by-class sweep in
   `feedback-inline-desktop.html` and `feedback-inline-mobile.html`.
   Preserve every other tablist attribute (roving tabindex,
   aria-selected).
6. **Component name (FB-96)** — rewrite `MobileFeedbackPanel`
   across live authored files (DESIGN-BRIEF, state-coverage-grid,
   aria-*specs*). **Frozen units (unit-19, unit-22) are not
   modified** — instead, pin the canonical name in
   `state-coverage-grid.md §0` so reviewers read past the legacy
   references.
7. **Rounded shade (FB-99)** — sweep `feedback-card-states.html`
   per DESIGN-TOKENS §1.5 mapping: pills → `rounded-full`, buttons
   → `rounded-md`.

Design-reviewer hat:

1. Run each feedback body's literal grep recipe against the
   post-fix state.
2. Confirm no regressions in neighboring classes (e.g. gray→stone
   sweep doesn't accidentally leave mixed gray/stone on a single
   element).
3. Verify the component-name pin in `state-coverage-grid.md §0`
   preserves visibility on the legacy unit-19/unit-22 references
   without modifying those frozen documents.

Feedback-assessor hat:

1. Re-run every listed grep recipe literally.
2. Confirm all eight feedback items close.

## Out of scope

- Artifact-level opacity-ban remediation — **unit-26**.
- Spec-prose alignment with opacity ban — **unit-27**.
- Focus-visible canonicalization — **unit-29**.
- Keyboard activation + live-region wiring — **unit-30**.
- Contrast + typography specifics — **unit-31**.

## Completion criteria

- [ ] Sidebar width normalized to `xl:w-96` stage-wide (0 `lg:w-96` hits)
- [ ] `max-w-[1400px]` removed from every artifact
- [ ] `stage-progress-strip.html` contains 0 `gray-*` classes
- [ ] `contrast-and-type-audit.md` contains 0 `Re-open` hits (outside feedback/unit docs)
- [ ] Tab active color normalized to teal-600/teal-400 in every tablist
- [ ] `MobileFeedbackPanel` removed from authored files (live scope only; frozen units untouched)
- [ ] Bare `rounded` removed from every artifact; explicit shade on each occurrence
- [ ] Feedback-assessor confirms FB-87, FB-88, FB-89, FB-90, FB-91, FB-96, FB-99, FB-101
