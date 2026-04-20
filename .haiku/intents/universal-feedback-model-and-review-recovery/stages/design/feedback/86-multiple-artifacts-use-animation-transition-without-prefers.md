---
title: >-
  Multiple artifacts use animation/transition without prefers-reduced-motion
  guard — vestibular WCAG 2.3.3
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T03:01:02Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

`motion-and-reduced-motion-spec.md` mandates every animation / transition be guarded by `@media (prefers-reduced-motion: reduce)`. Spot audit across the design artifacts shows five files that declare animations / transitions with no guard:

```
GUARD-MISSING: agent-feedback-toggle-spec.html  (6 animation declarations, 0 guards)
GUARD-MISSING: assessor-summary-card.html       (1 animation, 0 guards)
GUARD-MISSING: comments-list-with-agent-toggle.html (3 animations, 0 guards)
GUARD-MISSING: feedback-inline-mobile.html      (5 animations, 0 guards)
GUARD-MISSING: review-package-structure.html    (1 animation, 0 guards)
```

**Why this matters:**

1. WCAG 2.3.3 Animation from Interactions (Level AAA, but often treated as AA by motion-sensitivity accommodations): animation from UI interactions should be disableable.
2. WCAG 2.2.2 Pause, Stop, Hide (Level A): moving / blinking / scrolling / auto-updating content that starts automatically, lasts > 5s, and runs in parallel with other content must be pausable / stoppable / hideable.
3. **Vestibular disorder users** (non-trivial portion of the population — migraines, Ménière's, concussion recovery) report nausea / dizziness from unguarded movement. FAB pulse, toggle-thumb slide, modal fade-in all trigger this.

**Specific unguarded animations to verify:**

- `agent-feedback-toggle-spec.html`: the `.transition-transform` on the toggle thumb (multiple states). Even a 200ms translateX is harmful to some users.
- `feedback-inline-mobile.html`: the FAB pulse + bottom-sheet slide-in + tab-strip horizontal scroll + sheet close transition + optimistic-UI flip. FB-20 was supposed to add a reduced-motion guard for the FAB pulse — verify it landed.
- `comments-list-with-agent-toggle.html`: toggle thumb transitions (same as above).
- `assessor-summary-card.html`: card-mount fade-in (when `role="status"` fires).

**Fix:**

1. Every artifact that declares an animation or transition must include a `<style>` block with:
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

2. Or, for per-component control, guard each named animation explicitly (e.g., `.fab-pulse { animation: pulse 2s infinite } @media (prefers-reduced-motion: reduce) { .fab-pulse { animation: none } }`).

3. Update `motion-and-reduced-motion-spec.md` to add a verification step checking every artifact, not just the FAB:
```bash
for f in stages/design/artifacts/*.html; do
  anim=$(grep -cE '@keyframes|animation:|animate-pulse|animate-spin|transition-' $f)
  guard=$(grep -cE 'prefers-reduced-motion' $f)
  if [ "$anim" -gt 0 ] && [ "$guard" -eq 0 ]; then echo "MISSING: $f"; fi
done
# must be empty
```

4. Cross-check `feedback-inline-mobile.html` specifically — its FAB pulse and bottom-sheet slide are user-visible, frequently repeated, and the most likely to trigger vestibular symptoms during extended review sessions.
