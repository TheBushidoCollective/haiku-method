---
title: >-
  Stage-wide prefers-reduced-motion guards — every artifact with animations or
  transitions ships a guard; motion-spec verification loop extended stage-wide
type: design
closes:
  - FB-86
depends_on: []
inputs:
  - stages/design/artifacts/motion-and-reduced-motion-spec.md
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/comments-list-with-agent-toggle.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/review-package-structure.html
outputs:
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/comments-list-with-agent-toggle.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/review-package-structure.html
  - stages/design/artifacts/motion-and-reduced-motion-spec.md
  - stages/design/artifacts/rollback-reason-banner.html
  - stages/design/artifacts/unit-25-design-review.md
quality_gates:
  - >-
    Every artifact under `stages/design/artifacts/` that declares animations or
    transitions ships a `prefers-reduced-motion` guard — either as a global
    `@media` block disabling `animation-duration`, `animation-iteration-count`,
    `transition-duration`, and `scroll-behavior`, OR as per-component guards
    that set `animation: none` on each named keyframe. The five artifacts named
    in FB-86 (`agent-feedback-toggle-spec.html`, `assessor-summary-card.html`,
    `comments-list-with-agent-toggle.html`, `feedback-inline-mobile.html`,
    `review-package-structure.html`) each carry a guard, and the following shell
    script returns no MISSING lines: `for f in stages/design/artifacts/*.html;
    do anim=$(grep -cE
    '@keyframes|animation:|animate-pulse|animate-spin|transition-' $f);
    guard=$(grep -cE 'prefers-reduced-motion' $f); if [ "$anim" -gt 0 ] && [
    "$guard" -eq 0 ]; then echo "MISSING: $f"; fi; done` → empty output.
  - >-
    `feedback-inline-mobile.html` specifically guards the FAB pulse, the
    bottom-sheet slide-in, the tab-strip horizontal scroll, the sheet close
    transition, and the optimistic-UI flip. FB-20's earlier claim that a
    FAB-pulse guard landed is verified — if absent, it is added in this unit.
    `grep -cE 'prefers-reduced-motion'
    stages/design/artifacts/feedback-inline-mobile.html` returns ≥ 1.
  - >-
    `motion-and-reduced-motion-spec.md` carries a verification-step section
    (call it §N.verify or §10.audit) with the exact shell script above as the
    canonical audit, stated as "every artifact, not just the FAB". The script's
    expected output is specified as "empty output = pass". A comment near the
    script notes that the audit is run stage-wide, not per-artifact-input —
    mirroring the scope-widening approach unit-21 took for the contrast audit.
  - >-
    Reduced-motion guards MUST NOT eliminate essential transitions that convey
    state — e.g. the FAB's `aria-expanded=true/false` change is visual state,
    not motion; the sheet's `hidden` class toggle is visual state; the toggle
    thumb's `aria-checked=true/false` is visual state. The guard reduces
    `animation-duration` and `transition-duration` to `0.01ms`, not `none`, so
    final positions still paint. `animate-pulse` on the FAB may use `animation:
    none` since the pulse is decorative. Documented in
    `motion-and-reduced-motion-spec.md §N` as the "minimum-duration, not none"
    rule.
status: active
bolt: 1
hat: feedback-assessor
started_at: '2026-04-20T05:08:30Z'
hat_started_at: '2026-04-20T05:18:59Z'
iterations:
  - hat: designer
    started_at: '2026-04-20T05:08:30Z'
    completed_at: '2026-04-20T05:15:08Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T05:15:08Z'
    completed_at: '2026-04-20T05:18:59Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T05:18:59Z'
    completed_at: null
    result: null
---
# Stage-wide prefers-reduced-motion guards

## Scope

**FB-86**: a spot audit across `stages/design/artifacts/` found five
files declaring animations or transitions with no
`prefers-reduced-motion` guard — `agent-feedback-toggle-spec.html` (6
animations, 0 guards), `assessor-summary-card.html` (1, 0),
`comments-list-with-agent-toggle.html` (3, 0), `feedback-inline-
mobile.html` (5, 0), `review-package-structure.html` (1, 0).

`motion-and-reduced-motion-spec.md` mandates guards for every
animation / transition. Vestibular-disorder users (migraines,
Ménière's, concussion recovery) report nausea and dizziness from
unguarded movement. WCAG 2.3.3 Animation from Interactions (Level
AAA, often treated as AA by motion accommodations) and WCAG 2.2.2
Pause / Stop / Hide (Level A) both apply.

The audit surface was narrower than the spec's reach. This unit
widens it and closes the guard gaps.

## Approach

Designer hat:

1. **Artifact-level fix**: for each of the five named artifacts, add
   (to an existing `<style>` block or in a new one at the top of
   `<head>`) a global guard:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
       scroll-behavior: auto !important;
     }
   }
   ```
   For artifacts with user-visible, frequently-repeating decorative
   animations (FAB pulse), pair with a per-component
   `animation: none` override under the same media query.
2. **Verification loop**: run the shell script from the FB-86 fix
   block against `stages/design/artifacts/*.html` after each edit.
   Script must emit no MISSING lines.
3. **Spec-level update**: amend
   `motion-and-reduced-motion-spec.md` with the canonical audit
   script (stage-wide scope), and document the
   "minimum-duration, not none" rule so reduced-motion doesn't
   eliminate essential state-conveying transitions (aria-expanded,
   aria-checked, hidden-class toggle, etc.).
4. **FB-20 cross-check**: confirm that the FAB-pulse guard claimed
   to land in an earlier iteration is actually present in
   `feedback-inline-mobile.html`. If absent, this unit adds it.

Design-reviewer hat runs the audit script, confirms empty output,
and walks the five named artifacts to confirm essential state
transitions still reach their final positions under the guard
(i.e., the 0.01ms duration is not `none` for class-toggle transitions
that convey state).

Feedback-assessor hat verifies FB-86 by running the audit script
and confirming the five named artifacts are no longer in the
MISSING list.

## Completion criteria

- [ ] Each of the five named artifacts has a `prefers-reduced-motion`
      guard
- [ ] Audit shell script against every `.html` artifact returns
      empty output
- [ ] `feedback-inline-mobile.html` specifically guards FAB pulse,
      sheet slide-in, tab-strip scroll, sheet close, optimistic-UI flip
- [ ] `motion-and-reduced-motion-spec.md` documents the stage-wide
      audit script and the minimum-duration-not-none rule
- [ ] feedback-assessor verifies FB-86 against the original
      MISSING-list findings and confirms each file is now compliant
