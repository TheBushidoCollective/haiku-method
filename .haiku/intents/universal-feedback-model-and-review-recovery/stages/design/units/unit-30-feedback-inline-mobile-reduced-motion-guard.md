---
title: >-
  feedback-inline-mobile.html — add prefers-reduced-motion guard for the FAB
  pulse and bottom-sheet slide-in keyframes. FB-86 was marked closed by
  non-existent unit-25 variant; live grep shows 2 keyframes with 0 guards. Also
  re-runs the stage-wide motion-audit script to catch any other regressions
type: design
closes:
  - FB-143
depends_on: []
inputs:
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/motion-and-reduced-motion-spec.md
outputs:
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/motion-and-reduced-motion-spec.md
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/comments-list-with-agent-toggle.html
  - stages/design/artifacts/review-package-structure.html
  - stages/design/artifacts/rollback-reason-banner.html
quality_gates:
  - >-
    `grep -c 'prefers-reduced-motion'
    stages/design/artifacts/feedback-inline-mobile.html` ≥ 1. The file carries a
    `<style>` block with the stage-canonical global guard prescribed by
    motion-and-reduced-motion-spec.md §Cross-file policy: ```css @media
    (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    } ``` Optionally paired with per-keyframe `animation: none !important;` on
    `.animate-pulse` / `[class*="feedback-pulse"]` / `.sheet-enter` for the FAB
    pulse (decorative; no essential state information lost by stopping it) — per
    motion-and-reduced-motion-spec.md's "FAB pulse is decorative" clause.
  - >-
    Stage-wide motion-audit script (re-run of unit-25's gate to catch the
    false-closure): `for f in stages/design/artifacts/*.html; do anim=$(grep -cE
    '@keyframes|animation:|animate-pulse|animate-spin| transition-' $f);
    guard=$(grep -cE 'prefers-reduced-motion' $f); if [ "$anim" -gt 0 ] && [
    "$guard" -eq 0 ]; then echo "MISSING: $f"; fi; done` → empty output. Every
    artifact with animations or transitions ships a reduced-motion guard.
  - >-
    `motion-and-reduced-motion-spec.md` — FAB pulse + bottom-sheet slide rows
    updated to cite the specific guard in feedback-inline-mobile.html (not just
    the spec-canonical guard block). Per-keyframe fallback behavior documented:
    sheet-open animates to final position at 0.01ms so the content paints; FAB
    pulse stops entirely (decorative only).
  - >-
    Motion-audit script added to `design-reviewer.md` hat spec gate list so it
    runs on every future iteration (prevents the false-closure pattern from
    recurring for FB-86 / FB-143's same failure shape).
status: completed
completed_at: '2026-04-20T19:50:45Z'
---
# feedback-inline-mobile reduced-motion guard

## Scope

**FB-143** — `feedback-inline-mobile.html` declares two `@keyframes`
animations:

- Line 58–65: `@keyframes sheet-up` — 0.3s ease-out, applied via
  `.sheet-enter` to the bottom-sheet on open.
- Line 67–74: `@keyframes feedback-pulse` — 2s ease-in-out × 3 iterations,
  applied to the FAB count badge.

The file carries **zero** `prefers-reduced-motion` media queries. This
contradicts both `motion-and-reduced-motion-spec.md` (which explicitly
calls these two animations out with `animation: none` fallbacks) and
FB-86, which was marked closed by `unit-25-stagewide-reduced-motion-guards`
but the guard never landed in this specific file.

Why it matters:

- WCAG 2.3.3 Animation from Interactions (AAA) — animation from UI
  interactions should be disableable.
- WCAG 2.2.2 Pause, Stop, Hide (A) — the 2s × 3 pulse exceeds 5s
  cumulative display and runs in parallel with other content; must be
  pausable/hideable.
- Vestibular-disorder users (migraines, Ménière's, concussion recovery)
  report nausea / dizziness from unguarded motion. The FAB pulse is the
  single most-called-out vestibular trigger in motion-and-reduced-motion-
  spec.md.

Unit-25's canonical guard block (already documented in motion-and-reduced-
motion-spec.md §Cross-file policy) is the landing pattern.

## Approach

**Designer hat:**

1. Add a `<style>` block to `feedback-inline-mobile.html` (inside `<head>`
   if one isn't already present, else append to existing) with the
   stage-canonical reduced-motion guard:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
       scroll-behavior: auto !important;
     }
     .animate-pulse, [class*="feedback-pulse"] { animation: none !important; }
   }
   ```
2. The per-keyframe `animation: none` on the FAB pulse stops it entirely
   (decorative — the amber badge count is the alternate signal).
3. The global `0.01ms` duration keeps essential state-conveying animations
   (sheet-open: aria-expanded true → sheet visible) intact — final
   positions paint.
4. Re-run the unit-25 motion-audit script to confirm no other artifact
   lost its guard in the meantime. If any artifact shows up as MISSING,
   this unit adds the guard there too.
5. Update `motion-and-reduced-motion-spec.md` to cite
   feedback-inline-mobile.html guard by line number.
6. Add the motion-audit script to `design-reviewer.md` hat spec gate list.

**Design-reviewer hat:**

- Run the live grep: `grep -c prefers-reduced-motion
  stages/design/artifacts/feedback-inline-mobile.html` → ≥ 1.
- Run the stage-wide motion-audit script → empty output.
- Walk `feedback-inline-mobile.html` with reduced-motion simulated in
  devtools. Confirm: FAB pulse stops; sheet still opens (to final
  position). No essential state transition is eliminated.

**Feedback-assessor hat:**

- Run the two greps. Both must pass.
- FB-143 closes on live-grep verification (not audit-prose).

## Completion criteria

- [x] feedback-inline-mobile.html has prefers-reduced-motion guard block
- [x] Stage-wide motion-audit script returns empty output
- [x] FAB pulse stops under reduced-motion; sheet still opens
- [x] motion-and-reduced-motion-spec.md cites the specific guard
- [x] Motion-audit script added to design-reviewer gate list
- [x] FB-143 closes on live-grep verification
