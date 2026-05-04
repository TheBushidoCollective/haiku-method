---
title: SPA Drift-Detected Banner + Drift Assessments view + outcome badges
model: sonnet
depends_on:
  - unit-10-spa-upload-http-endpoints
  - unit-12-spa-stage-output-replacement
inputs:
  - intent.md
  - knowledge/DESIGN-TOKENS.md
  - stages/design/DESIGN-BRIEF.md
  - product/ACCEPTANCE-CRITERIA.md
  - features/drift-assessment-visibility.feature
outputs:
  - packages/haiku-ui/src/molecules/DriftBanner.tsx
  - packages/haiku-ui/src/atoms/DriftEntryRow.tsx
  - packages/haiku-ui/src/pages/review/DriftAssessmentsView.tsx
  - packages/haiku-ui/src/atoms/OutcomeBadge.tsx
  - packages/haiku-ui/src/index.css
  - packages/haiku-ui/tests/DriftBanner.test.tsx
  - packages/haiku-ui/tests/DriftAssessmentsView.test.tsx
quality_gates:
  - name: biome
    command: >-
      bunx biome check packages/haiku-ui/src/molecules/DriftBanner.tsx
      packages/haiku-ui/src/atoms/DriftEntryRow.tsx
      packages/haiku-ui/src/pages/review/DriftAssessmentsView.tsx
      packages/haiku-ui/src/atoms/OutcomeBadge.tsx
  - name: typecheck
    command: bun run --cwd packages/haiku-ui typecheck
  - name: ui-tests
    command: bun run --cwd packages/haiku-ui test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku-ui/src/molecules/DriftBanner.tsx
      packages/haiku-ui/src/atoms/DriftEntryRow.tsx
      packages/haiku-ui/src/pages/review/DriftAssessmentsView.tsx
      packages/haiku-ui/src/atoms/OutcomeBadge.tsx
  - name: no-raw-hex
    command: >-
      ! grep -nE '#[0-9a-fA-F]{3,8}\b'
      packages/haiku-ui/src/molecules/DriftBanner.tsx
      packages/haiku-ui/src/atoms/DriftEntryRow.tsx
      packages/haiku-ui/src/pages/review/DriftAssessmentsView.tsx
      packages/haiku-ui/src/atoms/OutcomeBadge.tsx
status: completed
bolt: 1
hat: ''
started_at: '2026-04-30T22:06:43Z'
hat_started_at: '2026-04-30T22:06:43Z'
iterations:
  - hat: ''
    started_at: '2026-04-30T22:06:43Z'
    completed_at: '2026-04-30T22:18:23Z'
    result: advance
completed_at: '2026-04-30T22:18:23Z'
---
# SPA Drift-Detected Banner + Drift Assessments view + outcome badges

## Scope

Build the third SPA surface from `stages/design/DESIGN-BRIEF.md` (Screen 3) plus the Drift Assessments view from `features/drift-assessment-visibility.feature`. Both surfaces are read-only — no "Run now", no "Accept", no "Surface", no "Ignore" buttons (per the passive-observer constraint locked in SPA-UI-SPECS.md §0 / §4.6 and ARCHITECTURE.md §7.3 — note: DESIGN-BRIEF Screen 3 mentions a "Run now" button, but the architecture's passive-observer rule supersedes it; if the design and architecture conflict here, the architecture wins per the precedence rule in ARCHITECTURE.md §1).

**Resolution of design/architecture conflict:** the banner does NOT render a "Run now" button. The header reads "The next workflow tick will assess impact." with no manual-trigger affordance. This is consistent with AC-G3 (harness does not pre-classify), AC-OM1 (mode-equivalence — autopilot already drives the next tick), and SPA-UI-SPECS.md §0 (Direction A passive observer). Update the design-stage brief in a follow-up FB if it is still out-of-sync after this lands.

Deliverables:

1. **`DriftBanner.tsx`** (molecule) — sticky banner mounted in `ReviewPage` main pane between `StageBanner` and `RereviewBanner`. Renders only when the SPA's WS feed indicates `drift_detected: true` for the active stage (the `drift_detected` event from DATA-CONTRACTS.md §6.1). Auto-unmounts on `tick_complete` / `assessment_recorded` event. Header: amber leading icon + "Out-of-band change detected" title + "N files changed since the last tick. The next workflow tick will assess impact." subtext + disclosure caret. Props: `drift: DriftEntry[]`, `onOpenFile(entry)`, `onViewDiff(entry)`.
2. **`DriftEntryRow.tsx`** (atom) — one row in the expanded list. Stage chip / intent chip on left (reuses `KIND_BADGE` palette from `StageReview.tsx`), monospace path (truncate-mid for long paths), timestamp + action right-aligned. Props: `entry: { path, stage, intent, action: 'modified' | 'added' | 'deleted', age }`, `onView`.
3. **`DriftAssessmentsView.tsx`** (page) — full route at `/review/{intentSlug}/drift-assessments` (or as a section inside the existing intent overview — final placement follows the existing `ReviewPage` route conventions). Lists most-recent-first via `GET /api/intents/{intentSlug}/assessments`. Each row: file path(s), change_kind, outcome badge, created_at, rationale excerpt. Click reveals full `diff_unified` and full `agent_rationale` in an expandable panel.
4. **`OutcomeBadge.tsx`** (atom) — outcome-to-label mapping per `features/drift-assessment-visibility.feature` Scenario Outline:
   - `ignore` → "Acknowledged"
   - `inline-fix` → "Acknowledged"
   - `surface-as-feedback` → "Surfaced as FB-NN" (interpolates `linked_feedback_id`); clicking navigates to the feedback detail view via existing routing
   - `trigger-revisit` → "Revisit invoked" (or "Pending revisit" / "Revisit in progress" per the SPA-state machine in `features/drift-assessment-visibility.feature` `pending-revisit` scenario)
   - SPA states (DATA-CONTRACTS.md §2.2 / §2.3 reference): `pending-revisit` (Assessment.outcome === 'trigger-revisit' AND PendingMarker.cleared_at === null AND `Assessment.revisit_invoked_at === null`), `revisit-invoked` (`Assessment.revisit_invoked_at !== null` AND PendingMarker.cleared_at === null), `resolved` (PendingMarker.cleared_at !== null).
   - Drift-state colors per DESIGN-TOKENS.md §1.3.2: `--color-drift-detected-fg/-bg` (pre-classification), `--color-drift-acknowledged-fg/-bg` (`ignore`/`inline-fix`), `--color-drift-surfaced-fg/-bg` (`surface-as-feedback`), `--color-drift-revisit-fg/-bg` (`trigger-revisit`).
5. **CSS additions in `index.css`:** add the new tokens from DESIGN-TOKENS.md §1.3.1 (origin badge `--color-origin-human-fg/-bg`), §1.3.2 (drift-state colors), §1.3.3 (baseline-state indicator) to the `@theme` block. Light + dark pairs.
6. **Per-card pending badge integration:** the artifact card in `StageReview` Outputs tab already gets `border-l-amber-400` from unit-12; this unit adds the per-card outcome badge once classification publishes. The badge updates from `Drift detected` → outcome label (Acknowledged / Surfaced as FB-NN / Pending revisit / Revisit invoked / Resolved) as the assessment lifecycle progresses, driven by `assessment_recorded` and `pending_marker_cleared` WS frames.
7. **Chat surface integration:** when the SPA receives an `assessment_recorded` event in autopilot mode, the chat surface auto-renders the agent's classification summary (covered by feature scenarios "Agent surfaces the classification result in chat after an autopilot tick", "Large tick classification is summarized in chat not listed individually", "Successive ignore-only ticks are summarized without per-file detail in chat"). The summary copy follows the format in those scenarios.

Accessibility (DESIGN-BRIEF Screen 3 §"Accessibility requirements"):

- Banner container: `role="status"`, `aria-live="polite"`.
- Disclosure: `aria-expanded` + `aria-controls` wired to the entry list region.
- Entry rows with primary action wrapped in `<button>`; non-actionable rows are `<div>` with no focus.
- Path text uses `<bdi>` for RTL safety.
- Color-not-only signal: amber leading icon + stripe border on banner; outcome badge text is the non-color signal for outcome state (SC-5.3).
- Reduced-motion: banner unmount fade replaced by immediate disappearance; pulse on new drift detected uses the existing `feedback-fab-pulse` keyframe (or the parameterised `.drift-detected-pulse` per DESIGN-TOKENS.md §6.4) which already has a `prefers-reduced-motion: reduce` override.
- Banner is BEFORE the tabs in DOM order so screen readers and keyboard users encounter it first.

Tests in `tests/DriftBanner.test.tsx` and `tests/DriftAssessmentsView.test.tsx`:

- DriftBanner mounts when `drift_detected: true` and unmounts on `tick_complete`.
- Disclosure reveals the entry list with the documented row layout.
- Per-card pending badge appears immediately after upload acknowledgment and clears once classification publishes.
- DriftAssessmentsView lists records most-recent-first.
- OutcomeBadge label table:
  - `ignore` → "Acknowledged" (badge color `--color-drift-acknowledged-fg/-bg`).
  - `inline-fix` → "Acknowledged".
  - `surface-as-feedback` linked to `FB-07` → "Surfaced as FB-07"; click navigates to `/review/{intent}/feedback/FB-07`.
  - `trigger-revisit` (pending-revisit state) → "Pending revisit"; transitions to "Revisit invoked" once `Assessment.revisit_invoked_at` is set; transitions to "Resolved" once PendingMarker.cleared_at is set.
- Empty-state renders when no `Assessment` records exist for the intent (Scenario "Drift assessment view shows empty state").
- Corrupt record renders with "Record could not be parsed" warning AND remaining records render normally (Scenario "Drift assessment view degrades gracefully on a corrupted record").
- Chat-surface autopilot summary: 12 mixed-outcome classifications produce a single summarised line "12 changes detected: 9 ignored, 2 inline-fix, 1 surface-as-feedback" with a deep link to the filtered DriftAssessmentsView.
- ARIA: banner has `role="status"` and `aria-live="polite"`; assessments view rows are keyboard-focusable.
- Reduced-motion: banner unmount transition replaced by immediate disappearance under `prefers-reduced-motion: reduce`.
- Token discipline: every color reference resolves to a token (the `no-raw-hex` gate enforces this).
- Architecture-vs-design conflict: the banner header does NOT include a "Run now" button — the SPA-UI-SPECS.md §0 passive-observer constraint takes precedence over the DESIGN-BRIEF Screen 3 wording. Test asserts no element matches the "Run now" text.

## Completion Criteria

- All four component files exist with the named exports.
- New tokens from DESIGN-TOKENS.md §1.3.1 / §1.3.2 / §1.3.3 are added to `packages/haiku-ui/src/index.css` `@theme` (light + dark pairs).
- Every scenario in `features/drift-assessment-visibility.feature` is covered by a passing test.
- Biome, `bun run --cwd packages/haiku-ui typecheck`, `bun run --cwd packages/haiku-ui test` all pass.
- No raw hex.
- No placeholders.
