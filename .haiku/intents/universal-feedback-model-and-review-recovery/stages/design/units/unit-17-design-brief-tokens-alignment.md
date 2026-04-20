---
title: >-
  DESIGN-BRIEF / DESIGN-TOKENS alignment — retire legacy components,
  canonicalize copy and icon set
type: design
closes:
  - FB-40
  - FB-41
  - FB-43
  - FB-45
depends_on: []
inputs:
  - stages/design/DESIGN-BRIEF.md
  - knowledge/DESIGN-TOKENS.md
  - stages/design/artifacts/footer-button-copy-spec.md
  - stages/design/artifacts/aria-landmark-spec.md
  - stages/design/artifacts/component-inventory.md
outputs:
  - stages/design/DESIGN-BRIEF.md
  - knowledge/DESIGN-TOKENS.md
  - stages/design/artifacts/component-inventory.md
  - stages/design/artifacts/footer-button-copy-spec.md
  - stages/design/artifacts/unit-17-design-review.md
  - stages/design/artifacts/comment-to-feedback-flow.html
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/state-signaling-inventory.html
quality_gates:
  - >-
    FeedbackStatusBadge text shade is consistent across DESIGN-BRIEF §2 and
    DESIGN-TOKENS.md §2.1 — pick ONE shade per status pair, document it in both
    places, verify contrast ≥ 4.5:1 in light and dark modes. `diff <(grep -E
    'text-amber|text-blue|text-green|text-stone' DESIGN-BRIEF.md | sort) <(grep
    -E 'text-amber|text-blue|text-green|text-stone' DESIGN-TOKENS.md | sort)` —
    no divergence on the badge text-shade rows.
  - >-
    DESIGN-BRIEF contains NO references to the retired components —
    `SidebarSegmentedControl`, `Mine` tab (identity split), `FeedbackFAB`
    (desktop floating button, mobile FAB stays), `MobileFeedbackSheet` (the
    standalone sheet wrapper, superseded by the unified `MobileFeedbackPanel`
    inside the bottom sheet). `grep -nE
    'SidebarSegmentedControl|\bMine\b|FeedbackFAB(?!-pulse|\.)|MobileFeedbackSheet'
    DESIGN-BRIEF.md` returns 0. `AgentFeedbackToggle` MUST be documented in §2
    as a first-class component (per unit-13 / FB-32 ARIA spec).
  - >-
    Footer-button copy canonical matrix present in DESIGN-BRIEF §2 AND identical
    to footer-button-copy-spec.md: pending → "Dismiss" (single button,
    agent+human origins identical); addressed → "Verify & Close" (primary) +
    "Reopen" (secondary); closed → "Reopen" (single button); rejected → "Reopen"
    (single button). `Reject`, `Close` (standalone, distinct from "Verify &
    Close") MUST NOT appear as footer button labels in any artifact or
    DESIGN-BRIEF. `grep -EnW '(Reject|Close)( |$)'
    stages/design/artifacts/*.html | grep -E 'button|footer'` — every match
    audited and none is a footer-button label.
  - "Origin-icon emoji mapping is identical across DESIGN-BRIEF §2, DESIGN-TOKENS.md §2.2, and aria-landmark-spec.md §6. Canonical set: `\U0001F50D U+1F50D` (adversarial-review), `\U0001F517 U+1F517` (external-pr / external-mr), `✎ U+270E` (user-visual), `\U0001F4AC U+1F4AC` (user-chat), `\U0001F916 U+1F916` (agent). All three specs cite the SAME codepoints in the SAME order. Diffing the three mapping tables yields zero discrepancies."
  - >-
    DESIGN-BRIEF §2 declares itself the authoritative component inventory, with
    a "Retired components" subsection listing the retired names above and the
    rationale (one line each) so future readers don't resurrect them.
    component-inventory.md cross-links back to DESIGN-BRIEF §2 rather than
    duplicating component specs.
status: completed
bolt: 3
hat: feedback-assessor
started_at: '2026-04-20T01:54:22Z'
hat_started_at: '2026-04-20T02:47:50Z'
iterations:
  - hat: designer
    started_at: '2026-04-20T01:54:22Z'
    completed_at: '2026-04-20T02:01:59Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T02:01:59Z'
    completed_at: '2026-04-20T02:14:14Z'
    result: reject
    reason: >-
      Gate 3 fails: 'Reject' and 'Close' footer-button labels still present as
      live <button> elements in 3 artifacts (comment-to-feedback-flow.html,
      feedback-inline-desktop.html, feedback-inline-mobile.html) — 13 sites
      total. Gate explicitly bans these in any artifact. Canonical replacement
      is 'Dismiss' per DESIGN-BRIEF §2. Gates 1, 2, 4, 5 pass. Full findings in
      stages/design/artifacts/unit-17-design-review.md.
  - hat: designer
    started_at: '2026-04-20T02:14:14Z'
    completed_at: '2026-04-20T02:23:12Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T02:23:12Z'
    completed_at: '2026-04-20T02:29:01Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T02:29:01Z'
    completed_at: '2026-04-20T02:35:58Z'
    result: reject
    reason: "FB-40 still-pending: DESIGN-BRIEF §6 Contrast Ratios table (lines 734-740) still lists amber-700/blue-700/green-700 (with 4.9/5.1/4.5 ratios) and stone-700 on stone-200 8.3:1 for Rejected — contradicts §2 FeedbackStatusBadge table and DESIGN-TOKENS §2.1 which canonicalize amber-800/blue-800/green-800 and stone-500 on stone-100. FB-40 explicitly required §6 to be swept to -800 to reconcile. FB-45 still-pending: DESIGN-BRIEF §2, DESIGN-TOKENS §2.2, and aria-landmark-spec §6 agree on \U0001F50D/\U0001F517/✎/\U0001F4AC/\U0001F916, but state-signaling-inventory.html (cited by DESIGN-BRIEF §2 line 276 as the canonical rendered matrix) still renders the forbidden \U0001F6E1/\U0001F500/\U0001F441/✨ set across ~16 occurrences. FB-45 required grep -rE '\U0001F6E1|\U0001F500|✨' stages/design/ = 0. FB-41 and FB-43 are closed."
  - hat: designer
    started_at: '2026-04-20T02:35:58Z'
    completed_at: '2026-04-20T02:43:00Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T02:43:00Z'
    completed_at: '2026-04-20T02:47:50Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T02:47:50Z'
    completed_at: '2026-04-20T02:50:42Z'
    result: advance
completed_at: '2026-04-20T02:50:42Z'
---
# DESIGN-BRIEF / DESIGN-TOKENS alignment

## Scope

Four consistency findings all point at the same failure: the design spec
surfaces (DESIGN-BRIEF, DESIGN-TOKENS, the handful of alias specs like
aria-landmark / footer-button-copy / component-inventory) disagree with
each other on component lists, icon codepoints, status-badge shades, and
footer-button labels. A single rationalization pass fixes all four.

**FB-to-fix mapping:**

- **FB-40** (status badge text-shade disagreement): DESIGN-BRIEF §2 uses
  `-700`, DESIGN-TOKENS.md §2.1 uses `-800`, artifacts use `-800`. Pick
  one, document in both.
- **FB-41** (retired components still shipped in BRIEF): remove
  SidebarSegmentedControl / Mine / FAB-desktop / MobileFeedbackSheet
  references. Ensure AgentFeedbackToggle is properly documented.
- **FB-43** (footer-button copy not canonicalized): copy the full
  status × origin matrix from footer-button-copy-spec.md into
  DESIGN-BRIEF §2 so there's one source of truth.
- **FB-45** (origin-icon emoji divergence): rationalize DESIGN-BRIEF §2,
  DESIGN-TOKENS.md §2.2, aria-landmark-spec.md §6 onto a single emoji
  mapping with explicit codepoints.

## Approach

The designer hat will:

1. Read all four spec surfaces and identify the correct canonical
   values. Resolution policy:
   - **Badge text-shade**: adopt `-800` (matches DESIGN-TOKENS.md §2.1
     and the artifacts — most-implemented wins, contrast already
     verified at 4.9–5.1:1 light / ≥ 4.5:1 dark).
   - **Retired components**: remove references, add "Retired components"
     subsection to DESIGN-BRIEF §2 explaining what each was and why it
     was retired (prevents resurrection).
   - **Footer-button copy**: copy matrix from
     footer-button-copy-spec.md into DESIGN-BRIEF §2 as the canonical
     reference, make footer-button-copy-spec.md an alias pointing to
     DESIGN-BRIEF §2.
   - **Origin-icon emoji**: reconcile to the canonical 5-emoji set
     (🔍/🔗/✎/💬/🤖), cite codepoints in all three places identically.
2. Update DESIGN-BRIEF §2 as the authoritative source.
3. Update DESIGN-TOKENS.md §2.1 and §2.2 to match.
4. Update aria-landmark-spec.md §6 to match.
5. Update component-inventory.md to cross-link to DESIGN-BRIEF §2
   instead of duplicating specs.

The design-reviewer hat will run the grep/diff commands from the quality
gates and verify no divergence.

The feedback-assessor hat will verify each FB item's concrete claim
(e.g., "SidebarSegmentedControl still in DESIGN-BRIEF") is now false.

## Completion criteria

- [x] All 5 quality_gates pass
- [x] DESIGN-BRIEF §2 is the authoritative component inventory with a
      "Retired components" subsection
- [x] DESIGN-TOKENS.md §2.1 (badge shades) and §2.2 (origin emoji)
      match DESIGN-BRIEF exactly
- [x] aria-landmark-spec.md §6 emoji table matches DESIGN-BRIEF §2
- [x] footer-button-copy-spec.md is now an alias pointing at
      DESIGN-BRIEF §2 rather than duplicating specs
- [x] component-inventory.md cross-links to DESIGN-BRIEF §2 for each
      component rather than duplicating
