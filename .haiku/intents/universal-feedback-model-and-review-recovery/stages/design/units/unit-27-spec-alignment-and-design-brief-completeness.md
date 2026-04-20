---
title: >-
  Spec/prose alignment with opacity-ban + DESIGN-BRIEF §2 completeness — fix the
  specs that canonicalize banned tokens and add missing component specs for
  AssessorSummaryCard, StageProgressStrip, RevisitModal
type: design
closes: []
depends_on: []
inputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/contrast-and-type-audit.md
outputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/unit-27-design-review.md
quality_gates:
  - >-
    `state-coverage-grid.md` no longer canonicalizes opacity-as-state anywhere.
    Specifically the five rows called out in FB-100 are rewritten to the
    canonical muted-background state language: (1) line 52 (Feedback card
    compact disabled) reads "✓ (`bg-stone-100 dark:bg-stone-800` +
    `text-stone-600 dark:text-stone-300` + dashed border; `aria-disabled="true"`;
    no opacity)"; (2) line 73 (AgentFeedbackToggle disabled) reads "track/thumb
    muted via `bg-stone-200/bg-stone-700` + `border-stone-400/stone-500`; label
    text `text-stone-700 dark:text-stone-300` at full opacity;
    `aria-disabled="true"`; cursor-not-allowed. No `opacity-*` on the wrapper."
    (3) line 132 (Revisit-unit-list Locked card) is rewritten to describe the
    bolt-3 canonical treatment from `contrast-and-type-audit.md §6.3` — dashed
    stone border + muted surface, hover lifts to `bg-stone-100`, focus draws the
    canonical teal `focus-visible:ring-*`; drops every `opacity-*` reference.
    (4) line 150 (FeedbackStatusBadge disabled rationale) is rewritten so the
    row's rationale does not mention `opacity 0.6` at all. (5) line 190 (§7.7
    AgentFeedbackToggle disabled) mirrors the new line 73 treatment verbatim.
    `grep -nE '\bopacity\b' stages/design/artifacts/state-coverage-grid.md`
    returns 0 hits in rows that describe disabled, locked, or read-only states
    (any remaining `opacity` mentions are in explicit "banned" callouts and
    paired with the `ban` keyword — `grep -nE 'opacity[^"]*ban|ban[^"]*opacity'
    stages/design/artifacts/state-coverage-grid.md` returns each such mention).
  - >-
    Palette-substitution note (closes FB-125): FB-100 feedback body references
    the historical banned disabled pattern using `gray-*` tokens (e.g.
    "`bg-gray-200 ... text-gray-700 dark:text-gray-300`"). The rewritten
    `state-coverage-grid.md` rows use the canonical `stone-*` palette
    (`bg-stone-100`, `text-stone-600 dark:text-stone-300`, `bg-stone-200`,
    `border-stone-400`). A one-line inline comment immediately above each
    rewritten row or at the top of the affected §7 section documents the
    palette substitution: "Note: FB-100 body used `gray-*` historical tokens;
    canonical rewrite uses `stone-*` per DESIGN-TOKENS.md §1.1 SPA palette."
    `grep -nE 'FB-100.*stone-\*|palette substitution'
    stages/design/artifacts/state-coverage-grid.md` returns ≥ 1 hit.
  - >-
    `revisit-modal-states.html:101` prose no longer cites
    `disabled:opacity-50` as the canonical disabled pattern. Replacement reads:
    `<p class="text-xs text-stone-500 dark:text-stone-400 font-mono">disabled:
    bg-amber-300 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 +
    aria-disabled="true"</p>` followed by a one-line inline note:
    "`opacity-*` utilities on disabled controls are banned stage-wide — see
    `contrast-and-type-audit.md §4`." `grep -n 'disabled:opacity-50'
    stages/design/artifacts/revisit-modal-states.html` returns 0 hits. The
    rendered button markup (already canonical per the audit) is unchanged.
  - >-
    `DESIGN-BRIEF.md §2` gains a full component spec for each of
    `AssessorSummaryCard`, `StageProgressStrip`, `RevisitModal`, matching the
    depth of the existing eight new-component specs (Props interface in a
    TypeScript-style block, canonical Tailwind class pattern, compact/expanded
    variant note if relevant, list of states, accessibility contract). Each spec
    cross-references the source-of-truth artifact
    (`assessor-summary-card.html`, `stage-progress-strip.html`,
    `revisit-modal-states.html`) and the state-coverage-grid row (§7.10 / §7.11
    / §7.12). Specifically: (a) `AssessorSummaryCard` Props include
    `assessorVerdict: 'advance' | 'revisit' | 'escalate'`, `closedFeedbackIds:
    string[]`, `reopenedFeedbackIds: string[]`, `timeoutReason?: string`;
    canonical Tailwind base `bg-white dark:bg-stone-900 rounded-xl border
    border-stone-200 dark:border-stone-700 shadow-sm p-6`; accessibility contract
    cross-refs `aria-live-sequencing-spec.md §2` (polite region for "assessor
    completed" announcement). **Text-color contract (closes FB-127):** the
    `AssessorSummaryCard` Props spec documents that every text child MUST
    use a canonical stone-token pair — `text-stone-600 dark:text-stone-300`
    for body copy, `text-stone-500 dark:text-stone-400` for secondary
    metadata, `text-stone-900 dark:text-stone-100` for the verdict headline.
    Bare `text-stone-400` / `text-stone-500` / `text-stone-600` without a
    `dark:` companion is banned. Unit-31 enforces the contract via grep;
    this spec is the source of truth the enforcement cites. (b)
    `StageProgressStrip` Props include
    `stages: StageDescriptor[]`, `currentStageSlug: string`, `onStageSelect:
    (slug: string) => void`; canonical base `flex items-center gap-2
    overflow-x-auto`; accessibility contract mandates native `<a>` or `<button>`
    per-stage (not `<div role="link">`) and roving tabindex. (c) `RevisitModal`
    Props include `targetStageSlug: string`, `impactedUnits: UnitDescriptor[]`,
    `rollbackReason: string`, `onConfirm: () => Promise<void>`, `onCancel: () =>
    void`; canonical base `fixed inset-0 flex items-center justify-center p-4`
    on the overlay wrapper with `bg-white dark:bg-stone-900 rounded-xl
    shadow-2xl max-w-lg w-full` on the dialog; accessibility contract mandates
    `role="dialog"` + `aria-modal="true"` + initial-focus target + `inert` on
    non-dialog roots.
  - >-
    `DESIGN-BRIEF.md §9 File Inventory` gains three new rows for
    `review-app/src/components/AssessorSummaryCard.tsx`,
    `review-app/src/components/StageProgressStrip.tsx`,
    `review-app/src/components/RevisitModal.tsx`, each marked "New (design stage)"
    with a source-of-truth column pointing at the corresponding
    `stages/design/artifacts/*.html` file. The §9 table stays alphabetical where
    the existing rows are alphabetical (or section-grouped where they are
    section-grouped — match the current convention). `grep -n
    'AssessorSummaryCard.tsx' stages/design/DESIGN-BRIEF.md`, `grep -n
    'StageProgressStrip.tsx' ...`, `grep -n 'RevisitModal.tsx' ...` each return
    ≥ 1 hit.
  - >-
    `DESIGN-BRIEF.md §2` FB-56 callout (around line 119) is verified: every
    component named in the callout now has a full §2 spec. `grep -n
    'AssessorSummaryCard' stages/design/DESIGN-BRIEF.md` returns a §2 header
    match; likewise `StageProgressStrip` and `RevisitModal`. The FB-56 callout
    itself remains unchanged — the fix is adding the specs it already mandates,
    not narrowing the callout.
  - >-
    feedback-assessor re-runs the FB-98 / FB-100 / FB-108 grep recipes literally
    and confirms: (a) every row in `state-coverage-grid.md` that describes
    disabled/locked state uses muted-background tokens, not opacity; (b)
    `revisit-modal-states.html:101` no longer cites `disabled:opacity-50`; (c)
    `DESIGN-BRIEF.md §2` has full specs for all three components; (d)
    `DESIGN-BRIEF.md §9` has rows for all three `.tsx` files.
status: pending
---
# Spec/prose alignment + DESIGN-BRIEF §2 completeness

## Scope

Iteration-4 adversarial review found three spec-level defects that
drive the repeat artifact-level violations unit-26 is chasing:

- **FB-100** · `state-coverage-grid.md` — the canonical state
  reference — canonicalizes the banned `opacity-50` / `opacity 0.6`
  patterns across five rows (lines 52, 73, 132, 150, 190). Every
  downstream designer / reviewer can legitimately cite this table
  when defending the banned pattern; the contradiction has to be
  resolved in the spec before the artifact-level grep enforcement
  can be trusted.
- **FB-108** · `revisit-modal-states.html:101` prose cites
  `disabled:opacity-50` as the canonical modal-button disabled
  pattern, contradicting the artifact's own rendered button (which
  uses the canonical amber token pair) and unit-11 / unit-18 bans.
- **FB-98** · `DESIGN-BRIEF.md §2` FB-56 callout (line 119) mandates
  that `AssessorSummaryCard`, `StageProgressStrip`, `RevisitModal`
  have full §2 specs and §9 file-inventory rows — only the first
  eight components listed in the callout actually do. This unit
  lands **Option A** from FB-98 (add the missing specs, not narrow
  the callout), per user direction.

## Approach

Designer hat:

1. **`state-coverage-grid.md` sweep** — open the file, rewrite the
   five rows called out in FB-100 to use the canonical muted-
   background + full-α-text token pair. Keep the row order and
   section headers; only the state-treatment cells change.
2. **`revisit-modal-states.html:101` prose** — rewrite the
   documentation line to describe the canonical amber token pair
   with `aria-disabled="true"`, plus a one-line inline note that
   `opacity-*` utilities on disabled controls are banned stage-wide.
3. **DESIGN-BRIEF §2 additions** — author three full component specs
   modeled on the existing eight new-component specs
   (`FeedbackStatusBadge` onward). Each spec has: Props interface
   block, canonical Tailwind class pattern, variants note, states
   list, and accessibility contract cross-referencing
   `aria-live-sequencing-spec.md` and `aria-landmark-spec.md`.
4. **DESIGN-BRIEF §9 additions** — add the three new `.tsx` rows to
   the File Inventory, preserving the existing alphabetical /
   section-grouped convention.

Design-reviewer hat:

1. Verify `state-coverage-grid.md` grep returns 0 bare `opacity`
   mentions in disabled/locked state rows.
2. Verify the three new DESIGN-BRIEF §2 specs are depth-consistent
   with the existing eight (same sub-sections in the same order).
3. Verify §9 rows cross-reference the `stages/design/artifacts/*.html`
   source-of-truth file for each new component.

Feedback-assessor hat:

1. Re-run the FB-100 row-by-row grep against `state-coverage-grid.md`.
2. Re-run the FB-108 grep against `revisit-modal-states.html`.
3. Re-run the FB-98 completeness checks against `DESIGN-BRIEF.md §2`
   and §9.
4. Confirm each feedback item closes.

## Out of scope

- Artifact-level HTML remediation for `revisit-unit-list.html`,
  `review-ui-mockup.html`, `annotation-popover-states.html`,
  `agent-feedback-toggle-spec.html`, `comment-to-feedback-flow.html`
  — handled by **unit-26**.
- Canonical-pair token drift (sidebar width, gray→stone, Re-open,
  magic numbers, rounded-size) — handled by **unit-28**.
- Focus-visible canonicalization in specs — handled by **unit-29**.

## Completion criteria

- [ ] `state-coverage-grid.md` rows 52, 73, 132, 150, 190 rewritten — no opacity-as-state canonicalization
- [ ] `revisit-modal-states.html:101` no longer cites `disabled:opacity-50`
- [ ] DESIGN-BRIEF §2 has full specs for `AssessorSummaryCard`, `StageProgressStrip`, `RevisitModal`
- [ ] DESIGN-BRIEF §9 has file-inventory rows for each of the three new `.tsx` components
- [ ] Feedback-assessor confirms FB-98, FB-100, FB-108 against their literal grep recipes
