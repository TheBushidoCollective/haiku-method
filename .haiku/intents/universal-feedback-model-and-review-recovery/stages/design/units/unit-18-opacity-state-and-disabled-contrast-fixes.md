---
title: Remove opacity on state + fix disabled button contrast across all artifacts
type: design
closes:
  - FB-46
  - FB-49
  - FB-61
depends_on: []
inputs:
  - stages/design/DESIGN-BRIEF.md
  - knowledge/DESIGN-TOKENS.md
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/comments-list-with-agent-toggle.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/contrast-and-type-audit.md
outputs:
  - stages/design/artifacts/
  - stages/design/DESIGN-BRIEF.md
  - knowledge/DESIGN-TOKENS.md
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/unit-18-design-review.md
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/footer-button-copy-spec.md
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/revisit-modal-states.html
quality_gates:
  - >-
    `grep -rEn 'opacity-70|opacity-50' stages/design/artifacts/ | grep -v
    'backdrop-blur\|black/50\|modal-overlay'` returns 0 matches on card roots.
    Closed/rejected card visual differentiation comes from: (a) background tint
    (`bg-green-50/60` closed, `bg-stone-100` rejected for light;
    `dark:bg-green-900/20` / `dark:bg-stone-800/50` for dark), (b) left-border
    color, (c) status-glyph icon, and (d) text prefix — NEVER α-composite
    opacity on the card root.
  - >-
    Disabled buttons use a documented token pair with ≥ 4.5:1 text contrast and
    ≥ 3:1 non-text (border) contrast per WCAG 2.2 1.4.11. Canonical pairs (from
    unit-11 and DESIGN-BRIEF §2): Secondary disabled light: `bg-stone-100
    text-stone-600 border border-stone-400 cursor-not-allowed` (6.85:1 text,
    3.4:1 border). Secondary disabled dark: `dark:bg-stone-800
    dark:text-stone-300 dark:border-stone-500` (10.2:1, 3.2:1). Primary green
    disabled: `bg-green-300 text-green-800 dark:bg-green-900/40
    dark:text-green-200` (5.1:1 light, 7.8:1 dark). `grep -rEn 'bg-stone-200
    text-stone-500|disabled:opacity-50' stages/design/artifacts/` returns 0.
    Non-canonical disabled pairs flagged per-line in contrast-and-type-audit.md
    §4.
  - >-
    Every `<button disabled>` or `<input disabled>` carries
    `aria-disabled="true"`. `grep -rEn 'disabled[ >]' stages/design/artifacts/ |
    wc -l` — `grep -rEn 'aria-disabled="true"' stages/design/artifacts/ | wc -l`
    ≥ the button count on each file. contrast-and-type-audit.md §5 lists each
    disabled control with aria-disabled coverage status.
  - >-
    Closed feedback card state (light): `bg-green-50/60 border-l-4
    border-l-green-600` + green checkmark glyph in the status-signal circle +
    "Closed · " text prefix in metadata line. Strikethrough optional on title
    (NOT on metadata, which must remain readable). Rendered in
    feedback-card-states.html and state-signaling-inventory.html.
  - >-
    Rejected feedback card state (light): `bg-stone-100 border-l-4
    border-l-stone-500` + red-x glyph in the status-signal circle + "Rejected ·
    " text prefix in metadata line. Title rendered with `text-stone-500
    line-through decoration-stone-500` at FULL opacity (not composited with
    opacity-50). Visible at compact width without clipping mid-word.
  - >-
    DESIGN-BRIEF §2 "Banned Text-on-Surface Pairs" table (from unit-11) extended
    with an "opacity on state" row explicitly forbidding `opacity-70` on closed
    card roots and `opacity-50` on rejected card roots, with the replacement
    tokens above. DESIGN-TOKENS.md §3 adds the canonical
    closed/rejected/pending/addressed background tokens.
status: active
bolt: 3
hat: designer
started_at: '2026-04-20T01:54:04Z'
hat_started_at: '2026-04-20T02:31:00Z'
iterations:
  - hat: designer
    started_at: '2026-04-20T01:54:04Z'
    completed_at: '2026-04-20T02:00:09Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T02:00:09Z'
    completed_at: '2026-04-20T02:16:54Z'
    result: reject
    reason: >-
      QG1/QG2/QG3 fail repo-wide (gates grep all of stages/design/artifacts/,
      not the 7 declared inputs). 6 material hits in sibling artifacts:
      revisit-modal-states.html:100,155,460 (opacity-50 on disabled buttons),
      agent-feedback-toggle-spec.html:181 (opacity-50 on label wrapper),
      review-ui-mockup.html:136,153 (opacity-60 on disabled stage buttons),
      review-ui-mockup.html:856 (bg-gray-100 text-gray-400 = 2.9:1),
      footer-button-copy-spec.md:63 (documents opacity-50 as standard). Plus 2
      tokens-doc drifts: DESIGN-TOKENS.md §1.7:165 still canonicalizes
      disabled:opacity-50 and §2.3 lists old closed/rejected backgrounds. See
      stages/design/artifacts/unit-18-design-review.md §7 for the numbered sweep
      and §9 for sign-off criteria.
  - hat: designer
    started_at: '2026-04-20T02:16:54Z'
    completed_at: '2026-04-20T02:24:56Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T02:24:56Z'
    completed_at: '2026-04-20T02:31:00Z'
    result: reject
    reason: >-
      QG1 extended fails: 11 opacity-60 hits remain across
      stages/design/artifacts/ (9 on revisit-unit-list.html locked-card roots, 1
      on comment-to-feedback-flow.html:962 collapsed-card root, plus 2
      decorative overlays). Audit §6.2 Bolt-4 summary table claims "0 hits /
      PASS" for this exact grep — factually wrong and self-contradicts
      DESIGN-TOKENS.md §1.7 repo-wide ban. Also 1 QG1-original literal match in
      state-signaling-inventory.html:363 prose inside <code>.
      QG2/QG3/QG4/QG5/QG6 pass; 7 declared inputs pass; bolt-1→bolt-2 sweep of
      the 4 flagged siblings is clean. See bolt-2 design review §3, §8, §9 for
      specific remediation.
  - hat: designer
    started_at: '2026-04-20T02:31:00Z'
    completed_at: null
    result: null
---
# Opacity-on-state removal + disabled button contrast

## Scope

Three findings span the same anti-pattern: α-composite opacity on stateful
surfaces (closed/rejected cards, disabled buttons) crushes text contrast
below WCAG 1.4.3 / 1.4.11 thresholds. Unit-11 banned this pattern but the
sweep missed several call sites, and the replacement tokens weren't
consistently applied.

**FB-to-fix mapping:**

- **FB-46** (closed/rejected card `opacity-70/50` regression, WCAG 1.4.3
  fail): replace with explicit token-based mute (background tint + border
  color + status glyph + text prefix).
- **FB-49** (disabled `bg-stone-200 text-stone-500` at 2.9:1 +
  `disabled:opacity-50` on text composing with white, WCAG 1.4.11 fail):
  replace with canonical disabled-control tokens from unit-11 /
  DESIGN-BRIEF §2.
- **FB-61** (closed/rejected cards still use full-card opacity in 4
  artifacts, fails state coverage): same root cause as FB-46, broader
  audit scope across 4+ artifact files.

## Approach

The designer hat will:

1. Enumerate every card-root `opacity-70` and `opacity-50` occurrence via
   the quality-gate grep. Cross-reference with feedback-card-states.html
   (canonical compact + expanded renders) to derive the replacement
   tokens.
2. Apply the replacement pattern per status:
   - `opacity-70` on closed cards → `bg-green-50/60 border-l-4
     border-l-green-600` + checkmark glyph + "Closed · " prefix
   - `opacity-50` on rejected cards → `bg-stone-100 border-l-4
     border-l-stone-500` + red-x glyph + "Rejected · " prefix +
     `text-stone-500 line-through decoration-stone-500` on title (full
     opacity)
   - `disabled:opacity-50` on button text → remove (the canonical
     disabled-control tokens already encode the muted appearance
     without opacity compositing)
   - `bg-stone-200 text-stone-500` on disabled buttons → `bg-stone-100
     text-stone-600 border border-stone-400 cursor-not-allowed`
3. Ensure every `disabled` attribute has a paired `aria-disabled="true"`
   (screen readers announce the state explicitly rather than inferring).
4. Re-render feedback-card-states.html and state-signaling-inventory.html
   to show the new closed/rejected visuals.
5. Update DESIGN-BRIEF §2 banned-pairs table with the opacity-on-state
   row. Update DESIGN-TOKENS.md §3 with the canonical status-background
   tokens.
6. Update contrast-and-type-audit.md §4 (disabled buttons) and §5
   (aria-disabled coverage) with measured post-sweep values.

The design-reviewer hat will run the grep gates and re-measure contrast
on disabled buttons and closed/rejected cards (sampled across the 4+
affected artifacts).

The feedback-assessor hat will verify each FB item's gate command
returns the expected value (zero for banned patterns, ≥ required
contrast for replacements).

## Completion criteria

- [ ] All 6 quality_gates pass
- [ ] Closed/rejected card visual tokens documented in DESIGN-TOKENS.md §3
- [ ] DESIGN-BRIEF §2 banned-pairs table extended with opacity-on-state
- [ ] aria-disabled coverage ≥ 100% of disabled controls
- [ ] feedback-card-states.html renders closed/rejected per new spec
- [ ] state-signaling-inventory.html updated
- [ ] contrast-and-type-audit.md §4 and §5 reflect post-sweep reality
