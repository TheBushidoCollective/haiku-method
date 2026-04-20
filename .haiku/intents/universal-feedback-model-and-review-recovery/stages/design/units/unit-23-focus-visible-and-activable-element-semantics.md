---
title: >-
  Focus-visible rings + activable-element semantics — apply rings on
  assessor-summary buttons, convert stage-progress role=link divs to real
  anchors/buttons
type: design
closes:
  - FB-76
  - FB-82
depends_on: []
inputs:
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/focus-ring-spec.html
outputs:
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/focus-ring-spec.html
  - stages/design/artifacts/unit-23-design-review.md
quality_gates:
  - >-
    Every interactive `<button>` in `assessor-summary-card.html` (at minimum:
    L83 dark-mode view-details, L123 light-mode view-details, L236 dark-mode
    view-log, L259 light-mode view-log, plus any per-item row buttons) carries
    `focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500
    focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900` as an
    applied class list — not just mentioned in prose. `grep -cE
    'class="[^"]*focus-visible:ring-2'
    stages/design/artifacts/assessor-summary-card.html` returns ≥ 4 (one per
    button across light + dark variants). The prose-level claim at L275 is
    retained but matched by applied classes on every interactive element.
  - >-
    Every stage node in `stage-progress-strip.html` (L87, L101, L115, L133,
    L147, L186, L196, L211 — every `<div class="stage-node">`) converted to
    either `<a href="#stage-{slug}" class="stage-node">` (preferred, real
    anchor, real keyboard activation, no JS required) or `<button type="button"
    class="stage-node">` (if the SPA uses non-hash routing). `role="link"` is
    removed once the element is a real `<a>` (role is redundant on native
    anchors). `grep -cE 'role="link"'
    stages/design/artifacts/stage-progress-strip.html` returns 0.
  - >-
    Every converted `.stage-node` element in `stage-progress-strip.html` carries
    `focus-visible:ring-2 focus-visible:ring-teal-500
    focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900
    outline-none` (or a named Tailwind utility class that expands to the same),
    satisfying `focus-ring-spec.html §1`'s canonical-ring mandate.
    Upcoming/disabled stages retain `tabindex="-1"` AND `aria-disabled="true"`
    (already at L133, L147); the active stage retains `aria-current="step"`
    (already at L115, L211); `role="link"` on disabled future-stage divs is
    dropped in favor of `<a aria-disabled="true" tabindex="-1">` semantics.
  - >-
    `focus-ring-spec.html §1` is amended with a paragraph: *"Elements that act
    as links MUST be native `<a href>`, not `<div role="link">`. `<div
    role="link">` requires an explicit `onkeydown` handler for Enter activation,
    does not inherit browser-default key handling, and is a known WCAG 2.1.1
    footgun. Use `<button type="button">` when the element switches view without
    a URL."* This paragraph gives the dev stage and future designers a normative
    rule, not just the current fix.
  - >-
    unit-23 verification: `grep -nE '<div[^>]*role="link"'
    stages/design/artifacts/` returns 0 across the entire artifacts directory
    (not only `stage-progress-strip.html`). If the sweep surfaces additional
    `<div role="link">` usages in any other artifact, the fix is applied
    consistently (convert to `<a>` or `<button>`) within this unit's scope. The
    final audit count is reported in the design-reviewer's verification note.
status: active
bolt: 5
hat: feedback-assessor
started_at: '2026-04-20T05:08:26Z'
hat_started_at: '2026-04-20T09:15:54Z'
iterations:
  - hat: designer
    started_at: '2026-04-20T05:08:26Z'
    completed_at: '2026-04-20T05:14:44Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T05:14:44Z'
    completed_at: '2026-04-20T05:18:56Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T05:18:56Z'
    completed_at: '2026-04-20T08:51:19Z'
    result: reject
    reason: >-
      FB-76 and FB-82 are both demonstrably closed (verified:
      assessor-summary-card.html lines 83/123/236/259 carry the canonical
      focus-visible ring on all 4 interactive buttons; stage-progress-strip.html
      has 0 `<div role="link">` and 10 native `<a href="#stage-...">` anchors
      with proper tabindex/aria-current/aria-disabled and the canonical
      focus-visible ring). However, advance_hat refused with `criteria_not_met:
      8 unchecked completion criteria` — the designer/reviewer hats did not tick
      off the unit's completion criteria on the unit spec before handoff.
      Bolting back so the prior hats can check off the criteria they completed;
      the FB-closure work itself is correct and should not be redone.
  - hat: designer
    started_at: '2026-04-20T08:51:19Z'
    completed_at: '2026-04-20T08:58:23Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T08:58:23Z'
    completed_at: '2026-04-20T09:00:48Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T09:00:48Z'
    completed_at: '2026-04-20T09:02:39Z'
    result: reject
    reason: >-
      FB-76 and FB-82 are both demonstrably closed — verified:
      assessor-summary-card.html L83/L123/L236/L259 carry the canonical
      `focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500
      focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`
      class list on all 4 interactive buttons; stage-progress-strip.html has 0
      `<div role="link">` and 10 native `<a href="#stage-...">` anchors with
      canonical focus-visible ring + proper tabindex/aria-current/aria-disabled;
      focus-ring-spec.html §1b (L111–L117) codifies the native-element mandate,
      §3 L175 lists `<div role="link">` as forbidden, §4 L188 adds the
      enforcement grep. However advance_hat refused with `criteria_not_met: 8
      unchecked completion criteria`. The checkboxes were ticked in the unit
      worktree's copy of the unit spec but the parent-visible unit file still
      shows all 8 `- [ ]` — the harness reads the parent path. Bolting back so
      the designer/reviewer hats tick the completion criteria on the unit spec
      in a way that reaches the parent worktree (e.g., check boxes + commit with
      merge-forward, or verify the unit-advance path captures the tick).
      FB-closure artifacts themselves are correct and should not be redone.
  - hat: designer
    started_at: '2026-04-20T09:02:39Z'
    completed_at: '2026-04-20T09:04:13Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T09:04:13Z'
    completed_at: '2026-04-20T09:06:48Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T09:06:48Z'
    completed_at: '2026-04-20T09:08:14Z'
    result: reject
    reason: >-
      FB-76 and FB-82 are BOTH demonstrably closed on inspection of the
      artifacts (verified: assessor-summary-card.html L83/123/236/259 carry the
      canonical `focus:outline-none focus-visible:ring-2
      focus-visible:ring-teal-500 focus-visible:ring-offset-2
      dark:focus-visible:ring-offset-stone-900` class list on all 4 interactive
      buttons — grep returns 4; stage-progress-strip.html has 0 `role="link"`
      matches and 10 native `<a href="#stage-...">` stage-node anchors with
      proper tabindex/aria-current/aria-disabled plus the canonical
      focus-visible ring — grep for `focus-visible:ring-2` returns 11;
      focus-ring-spec.html §1b L115 / §3 L175 / §4 L188 codify the
      native-element mandate + ban on `<div role="link">`). However,
      haiku_unit_advance_hat is blocked with `criteria_not_met: 9 unchecked
      completion criteria`. The prior feedback-assessor iteration (completed
      2026-04-20T08:51:19Z) rejected for the identical reason expecting
      designer/reviewer to tick all completion criteria on the unit spec — they
      still haven't. Feedback-assessor guardrails forbid editing artifacts, so
      the fix must happen in the designer/reviewer hats. Bolting back so
      designer/reviewer can check off ALL completion criteria boxes on the unit
      spec frontmatter/body before handoff. The FB-closure work itself is
      correct and should NOT be redone.
  - hat: designer
    started_at: '2026-04-20T09:08:15Z'
    completed_at: '2026-04-20T09:09:18Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T09:09:18Z'
    completed_at: '2026-04-20T09:11:10Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T09:11:10Z'
    completed_at: '2026-04-20T09:12:40Z'
    result: reject
    reason: >-
      FB-76 and FB-82 are demonstrably closed (verified against the artifacts:
      assessor-summary-card.html L83/123/236/259 carry the canonical
      `focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500
      focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`
      class list on all 4 interactive buttons; stage-progress-strip.html has 0
      `role="link"` occurrences and all 10 stage-nodes are native `<a
      href="#stage-{slug}">` anchors with proper
      tabindex/aria-current/aria-disabled + canonical focus-visible ring;
      focus-ring-spec.html §1b/§3/§4 codifies the native-element mandate;
      stage-wide HTML sweep returns 0 `<div role="link">` matches). However,
      advance_hat refused with `criteria_not_met: 9 unchecked completion
      criteria` — same bookkeeping wall that rejected bolt 1. Bolt-2/3/4
      designer/reviewer re-verified the artifact state but did not tick the
      criteria in the format the FSM recognizes (likely the frontmatter
      `quality_gates` items, not the markdown checkbox list at L161–L172).
      Bolting back so the designer can tick the actual FSM-tracked criteria; the
      FB-closure work and artifact state are correct and must not be redone.
  - hat: designer
    started_at: '2026-04-20T09:12:40Z'
    completed_at: '2026-04-20T09:14:00Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T09:14:00Z'
    completed_at: '2026-04-20T09:15:54Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T09:15:54Z'
    completed_at: null
    result: null
---
# Focus-visible rings + activable-element semantics

## Scope

Two findings describe interactive elements whose keyboard and visual
semantics don't match what the specs claim:

- **FB-76**: `assessor-summary-card.html:275` declares in prose that
  "focus:ring-2 focus:ring-teal-500" applies to every interactive
  element, but zero buttons in the file carry that class. Keyboard
  users see no focus indication because the focus-ring-spec CSS
  explicitly suppresses the browser default outline. WCAG 2.4.7
  Focus Visible fails.
- **FB-82**: `stage-progress-strip.html` wraps every stage node in
  `<div role="link" tabindex="0">`. `role="link"` on a `<div>` does
  not activate on Enter or Space — the browser's key handling only
  applies to native `<a>` and `<button>`. Screen-reader users hear
  "link, Design stage, completed" but pressing Enter is a no-op. The
  divs also lack `focus-visible:ring-*`, so the focus-ring-spec CSS
  suppression leaves them with no visible focus at all.

Both are stage-output artifacts that dev will wire React against.
Shipping them with broken keyboard semantics means the compliance
regression starts at the wireframe.

## Approach

Designer hat:

1. **FB-76 fix**: add `focus:outline-none focus-visible:ring-2
   focus-visible:ring-teal-500 focus-visible:ring-offset-2
   dark:focus-visible:ring-offset-gray-900` to every interactive
   `<button>` in `assessor-summary-card.html`. Confirm each button
   carries the class list in its actual `class=` attribute, not only
   in prose description.
2. **FB-82 primary fix**: convert every `<div class="stage-node"
   role="link">` to either `<a href="#stage-{slug}" class="stage-
   node">` (preferred) or `<button type="button" class="stage-node">`
   (if SPA uses non-hash routing). Remove `role="link"` from the
   converted elements. Add the canonical focus-visible ring classes to
   every converted node.
3. **FB-82 stage-wide sweep**: grep the entire
   `stages/design/artifacts/` directory for any other `<div role="link">`
   usages and apply the same conversion within this unit. Report the
   final count.
4. **Spec-level rule**: amend `focus-ring-spec.html §1` with a normative
   paragraph declaring `<div role="link">` a footgun and directing
   future work toward native `<a>` or `<button>`.

Design-reviewer hat runs the grep commands from the gate prose and
confirms each returns the expected count. Walks every button in
`assessor-summary-card.html` to confirm the focus-ring class list is
applied.

Feedback-assessor hat verifies FB-76 against the reviewer's exact
concern (four interactive buttons, zero focus-ring classes) and FB-82
against the keyboard-activation and focus-ring gaps the reviewer
cited.

## Completion criteria

- [x] `assessor-summary-card.html` has ≥ 4 buttons with
      `focus-visible:ring-2` in their class attribute
- [x] `stage-progress-strip.html` has 0 `role="link"` occurrences
- [x] Every stage-node is `<a href>` or `<button type="button">`
- [x] Every converted node carries the canonical focus-visible ring
- [x] Active stage retains `aria-current="step"`, disabled/future
      stages retain `tabindex="-1"` + `aria-disabled="true"`
- [x] `focus-ring-spec.html §1` carries the div-role=link footgun rule
- [x] Stage-wide grep: 0 `<div role="link">` across all artifacts
- [x] feedback-assessor verifies FB-76 and FB-82 against their concrete claims
