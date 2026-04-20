---
title: >-
  Component-level a11y fixes — dialog semantics, switch roles, state coverage,
  non-color status, touch targets, stage-progress keyboard, icon-only labels
type: design
closes:
  - FB-51
  - FB-53
  - FB-56
  - FB-60
  - FB-62
  - FB-64
  - FB-65
  - FB-66
depends_on: []
inputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/comments-list-with-agent-toggle.html
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/aria-landmark-spec.md
  - stages/design/artifacts/aria-live-sequencing-spec.md
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/touch-target-audit.md
outputs:
  - stages/design/artifacts/
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/touch-target-audit.md
quality_gates:
  - >-
    Mobile bottom sheet in feedback-inline-mobile.html and MobileFeedbackPanel
    in DESIGN-BRIEF have full dialog semantics: `role="dialog" aria-modal="true"
    aria-labelledby="sheet-title"` on the sheet root, `inert` +
    `aria-hidden="true"` applied to `<main id="main-content">` and `<header>`
    when the sheet is open, focus-trap implementation contract cites
    `focus-trap-react` (library, not hand-rolled), Escape closes the sheet, the
    FAB's `aria-expanded` flips appropriately. aria-landmark-spec.md §5
    documents the dialog-open / dialog-close lifecycle.
  - >-
    Agent-feedback toggle is rendered as a native `<button role="switch"
    aria-checked={showAgent}>` with a MINIMUM 44×44 touch target (use `min-w-11
    min-h-11` wrapping the 32×16 visual track, OR a 40×40 button with
    `touch-target` utility extending the hit area). `aria-label="Show agent
    feedback inline"` on the button. `Space`/`Enter` toggles. Canonical
    focus-visible ring applied. `grep -rnE
    '<label[^>]*>.*AgentFeedbackToggle|<div[^>]*role="switch"'
    stages/design/artifacts/` returns 0 matches for the div-as-switch pattern.
    agent-feedback-toggle-spec.html renders the canonical implementation.
  - >-
    state-coverage-grid.md enumerates every component from DESIGN-BRIEF §2 with
    a six-state row (default / hover / focus / active / disabled / error). At
    minimum: `FeedbackStatusBadge`, `FeedbackOriginIcon`, `FeedbackItem`
    (compact), `FeedbackItem` (expanded), `FeedbackList`, `FeedbackSummaryBar`,
    `AgentFeedbackToggle`, `MobileFeedbackPanel`, `AssessorSummaryCard`,
    `StageProgressStrip`, `RevisitModal`. Components where a state is N/A carry
    an explicit "N/A — <rationale>" cell (not silently omitted). DESIGN-BRIEF §2
    amended to require state-coverage-grid entries for new components.
  - >-
    Mobile filter pills (status filter: Pending / Addressed / Closed / All)
    convey status via BOTH color AND shape/text: - Colored dot (aria-hidden) +
    TEXT LABEL ("Pending", "Addressed",
      "Closed", "All") in the visible button content.
    - `aria-label` on the button includes the status name and count
      (e.g., `aria-label="Pending, 3 items"`).
    - `aria-pressed` on the active pill. Same pattern applied to group headers
    in the feedback list (section labels use status text, not a bare color
    strip). `grep -rEn '<button[^>]*class="[^"]*rounded-full[^"]*"'
    stages/design/artifacts/feedback-inline-mobile.html` — every status pill has
    a text label in the button's visible content.
  - >-
    AssessorSummaryCard in assessor-summary-card.html (and its references in
    DESIGN-BRIEF §2) applies `role="status" aria-live="polite"
    aria-atomic="true"` to the CARD ROOT, not just to a nested prose region.
    When the summary is updated (debounce-coalesced per
    aria-live-sequencing-spec.md §2.2), the live region announces the updated
    summary once. aria-live sequence documented in aria-live-sequencing-spec.md
    §3.
  - >-
    touch-target-audit.md correctly applies WCAG 2.5.5 / 2.5.8: EVERY button,
    link, and input on a mobile viewport (≤ 768px) has ≥ 44×44px effective hit
    area. The inline-text exception in 2.5.8 is applied ONLY to text links
    inside prose flow, NOT to standalone toolbar buttons, toast close buttons,
    popover ✕ buttons, or feedback-card footer buttons. Specific call-outs
    resolved: rollback-toast × button (was sub-44px), stage-progress-strip
    mobile stage nodes, popover ✕, feedback-card-states action buttons.
    touch-target-audit.md §2 lists every control with effective dimensions.
  - >-
    stage-progress-strip.html: future/upcoming stages (tabindex="-1") are
    KEYBOARD-REACHABLE through arrow-key roving tabindex within the strip, even
    though they are not in the Tab order. An arrow-key handler contract is
    documented in the artifact's inline script comment (or a sibling
    `stage-progress-keyboard-spec.md` if the HTML gets unwieldy). Hover-only
    tooltips MUST NOT be the sole affordance — Focus on arrow-navigated future
    stages reveals the same tooltip content. WCAG 1.4.13 (Content on Hover)
    satisfied: tooltip dismissible, hoverable, and persistent. Skip-link
    z-index/positioning verified not to overlap the focus ring on the first
    stage.
  - "Mobile theme-toggle button has `aria-label` describing the action (\"Switch to light theme\" / \"Switch to dark theme\" — dynamic based on current state). Applies to: feedback-inline-mobile.html, comment-to-feedback-flow.html, any other mobile artifact with an icon-only theme toggle. `grep -rEn '<button[^>]*>\\s*<svg|<button [^>]*\U0001F319|<button[^>]*☀' stages/design/artifacts/` — every match has `aria-label` on the button element."
status: active
bolt: 1
hat: designer
started_at: '2026-04-20T01:54:06Z'
hat_started_at: '2026-04-20T01:54:06Z'
iterations:
  - hat: designer
    started_at: '2026-04-20T01:54:06Z'
    completed_at: null
    result: null
---
# Component-level a11y fixes

## Scope

Eight findings describe distinct component-level accessibility gaps that
don't fall under the "global sweep" category. Each needs a targeted fix
to the component's structure, ARIA attributes, or coverage spec.

**FB-to-fix mapping:**

- **FB-51** (mobile sheet missing dialog semantics + focus trap): apply
  role="dialog" / aria-modal / aria-labelledby / focus-trap-react contract
  to the MobileFeedbackPanel sheet.
- **FB-53** (agent-feedback toggle div-label masquerading as switch):
  convert to native `<button role="switch" aria-checked>` with 44px
  touch target.
- **FB-56** (state-coverage-grid missing DESIGN-BRIEF §2 components): add
  rows for every inventoried component with explicit N/A rationales
  where applicable.
- **FB-60** (color-alone status on mobile filter pills): add text labels
  inside pill buttons, aria-pressed, aria-label with count.
- **FB-62** (AssessorSummaryCard missing role=status/aria-live on root):
  apply live-region to the card root, not just to a nested prose region.
- **FB-64** (touch-target audit misapplies WCAG 2.5.8 inline-text
  exception): re-audit with the correct interpretation of the exception,
  fix sub-44px toolbar/toast/popover controls.
- **FB-65** (stage-progress future stages keyboard-unreachable): add
  arrow-key roving tabindex, ensure focus reveals the same tooltip as
  hover, verify skip-link stacking.
- **FB-66** (mobile theme-toggle icon-only, no aria-label): add
  dynamic aria-label reflecting action.

## Approach

The designer hat will:

1. **MobileFeedbackPanel dialog (FB-51)**: update
   feedback-inline-mobile.html and DESIGN-BRIEF §2 to apply dialog
   semantics, cite focus-trap-react in the implementation contract,
   document the open/close lifecycle in aria-landmark-spec.md §5.
2. **Agent-feedback toggle (FB-53)**: rewrite the toggle markup in
   comments-list-with-agent-toggle.html, feedback-inline-desktop.html,
   feedback-inline-mobile.html, and agent-feedback-toggle-spec.html as
   a native button with role="switch" + aria-checked + 44×44 hit area.
3. **state-coverage-grid completeness (FB-56)**: enumerate DESIGN-BRIEF §2
   components, add rows for any missing. Use existing rows as template.
4. **Mobile filter pills (FB-60)**: add visible text labels and
   aria-label + aria-pressed to every pill button.
5. **AssessorSummaryCard (FB-62)**: move role="status" aria-live="polite"
   aria-atomic="true" to the card root element in
   assessor-summary-card.html and DESIGN-BRIEF §2 spec.
6. **Touch-target audit re-run (FB-64)**: reread touch-target-audit.md,
   correctly apply 2.5.8 inline-text exception (only prose links), fix
   every non-compliant control. Update the audit with post-fix
   dimensions.
7. **Stage-progress keyboard (FB-65)**: add arrow-key handler script
   comment (or separate spec file) to stage-progress-strip.html,
   ensure focus-visible reveals tooltips on future stages, re-verify
   skip-link z-index and positioning against the first stage node's
   focus ring.
8. **Mobile theme-toggle (FB-66)**: add dynamic aria-label to every
   icon-only theme-toggle button.

The design-reviewer hat will verify each component against the quality
gate using grep + manual a11y inspection (one component per gate).

The feedback-assessor hat will verify each FB item against the original
reviewer's concrete claim (e.g., for FB-53 — "no role='switch', no 44px
target" → verify both are now present).

## Completion criteria

- [ ] All 8 quality_gates pass
- [ ] aria-landmark-spec.md §5 documents MobileFeedbackPanel dialog lifecycle
- [ ] agent-feedback-toggle-spec.html renders canonical switch implementation
- [ ] state-coverage-grid.md has rows for all DESIGN-BRIEF §2 components
- [ ] touch-target-audit.md correctly interprets WCAG 2.5.8 and lists
      measured dimensions for every mobile-viewport control
- [ ] aria-live-sequencing-spec.md §3 updated for AssessorSummaryCard
- [ ] stage-progress-strip keyboard arrow-navigation contract documented
      (inline or sibling spec file)
- [ ] Every FB item listed in `closes:` verified by feedback-assessor
