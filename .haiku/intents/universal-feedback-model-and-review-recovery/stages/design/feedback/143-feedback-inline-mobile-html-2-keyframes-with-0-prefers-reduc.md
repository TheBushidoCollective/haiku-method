---
title: >-
  feedback-inline-mobile.html 2 keyframes with 0 prefers-reduced-motion — FB-86
  falsely closed — 2.3.3 FAIL
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T17:52:06Z'
iteration: 5
visit: 5
source_ref: null
closed_by: unit-30-feedback-inline-mobile-reduced-motion-guard
bolt: 0
upstream_stage: null
---

`feedback-inline-mobile.html` declares two `@keyframes` animations (`sheet-up` at line 58 and `feedback-pulse` at line 67) and applies them on the mobile FAB pulse + bottom-sheet slide. The file contains **zero** `prefers-reduced-motion` media queries. This contradicts both `motion-and-reduced-motion-spec.md` (which explicitly calls out these two animations with `animation: none` fallbacks) and FB-86, which was marked closed by unit-25-stagewide-reduced-motion-guards.

**Live audit (grep verified 2026-04-20):**

```
feedback-inline-mobile.html: 2 keyframes, 0 guards
```

- `grep -cE '@keyframes' feedback-inline-mobile.html` → 2
- `grep -cE 'prefers-reduced-motion' feedback-inline-mobile.html` → 0

The companion spec's verification script in `motion-and-reduced-motion-spec.md` §Verification is exactly this condition and should be failing CI if it ever ran.

**Animations present without a guard:**

- Line 58-65: `@keyframes sheet-up` — 0.3s ease-out, applied via `.sheet-enter` to the bottom-sheet on open. Sheet open is a location change; `motion-and-reduced-motion-spec.md` explicitly requires `animation: none` with a focus move + `aria-live` announcement as the reduced-motion substitute.
- Line 67-74: `@keyframes feedback-pulse` — 2s ease-in-out · 3 iterations, applied to the FAB count badge. Spec requires `animation: none` and calls out that the amber badge count is the alternate signal. The FAB pulse is the single most called-out vestibular trigger in the spec.

**Why this matters (vestibular a11y):**

1. WCAG 2.3.3 Animation from Interactions (AAA) — animation from UI interactions should be disableable.
2. WCAG 2.2.2 Pause, Stop, Hide (A) — the 2s × 3 pulse exceeds 5s cumulative display and runs in parallel with other content; it must be pausable/hideable.
3. Vestibular-disorder users (migraines, Ménière's, concussion recovery) report nausea/dizziness from unguarded movement. FB-86's own body text cites this.

**Fix required:**

1. Add the following `<style>` block to `feedback-inline-mobile.html`:
```css
@media (prefers-reduced-motion: reduce) {
  @keyframes sheet-up { from, to { transform: none; opacity: 1; } }
  @keyframes feedback-pulse { from, to { transform: none; opacity: 1; } }
  .sheet-enter { animation: none !important; }
  .animate-pulse, [class*="feedback-pulse"] { animation: none !important; }
  * { transition-duration: 0.01ms !important; }
}
```
2. Or, equivalently, a global blanket guard per `motion-and-reduced-motion-spec.md` §Cross-file policy:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
3. Re-open FB-86 and scope a follow-up unit to actually run the verification script in `motion-and-reduced-motion-spec.md` §Verification as a stage quality gate — that script would have caught this.
4. After fix: `grep -c prefers-reduced-motion feedback-inline-mobile.html` ≥ 1.

**WCAG refs:** 2.3.3 Animation from Interactions; 2.2.2 Pause, Stop, Hide.
