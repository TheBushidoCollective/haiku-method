---
unit: unit-25-stagewide-reduced-motion-guards
hat: design-reviewer
bolt: 1
result: approved
---
# Design Review — unit-25 stage-wide reduced-motion guards

Reviewer verified the designer output against unit-25's four quality gates
and the `design-reviewer` hat focus (state coverage, accessibility,
design-system consistency, responsive behavior at all breakpoints).

## Gate-by-gate findings

### Gate 1 — stage-wide guard audit returns empty

**PASS.** Ran the canonical audit from
`motion-and-reduced-motion-spec.md §10.audit` against every `.html`
artifact in `stages/design/artifacts/`:

```sh
for f in stages/design/artifacts/*.html; do
  anim=$(grep -cE '@keyframes|animation:|animate-pulse|animate-spin|transition-' "$f")
  guard=$(grep -cE 'prefers-reduced-motion' "$f")
  if [ "$anim" -gt 0 ] && [ "$guard" -eq 0 ]; then echo "MISSING: $f"; fi
done
```

Output is empty. Per-file tally: every artifact that declares any motion
(`anim > 0`) carries at least one `prefers-reduced-motion` guard. Artifacts
that declare no motion (`feedback-lifecycle-transitions.html`,
`focus-ring-spec.html`, `review-context-header.html`,
`review-flow-with-feedback-assessor.html`, `revisit-modal-spec.html`,
`state-signaling-inventory.html`) correctly omit the guard — the audit
predicate `anim > 0 && guard = 0` excludes them.

The five artifacts named in FB-86 — `agent-feedback-toggle-spec.html`,
`assessor-summary-card.html`, `comments-list-with-agent-toggle.html`,
`feedback-inline-mobile.html`, `review-package-structure.html` — each
carry the guard. A sixth, `rollback-reason-banner.html`, was caught by
the widened stage-wide audit and guarded in the same commit.

### Gate 2 — feedback-inline-mobile.html guards the five motion surfaces

**PASS.** Verified at lines 45-83:

1. **FAB pulse (`.feedback-fab-pulse`)** — explicit `animation: none !important`
   at line 74-76. Decorative animation is fully suppressed; amber count badge
   remains as the non-animated "unread" cue (matches DESIGN-BRIEF §7).
2. **Bottom-sheet slide-in (`.sheet-enter` / `@keyframes sheet-up`)** —
   explicit `animation: none !important` at line 80-82. Sheet appears
   in-place; focus-trap library moves focus on open and `aria-live` region
   announces state change.
3. **Tab-strip horizontal scroll** — global `scroll-behavior: auto !important`
   at line 71 neutralizes any smooth-scroll from Tailwind JIT or inline
   styles.
4. **Sheet close (`hidden` class toggle)** — the global
   `transition-duration: 0.01ms !important` at line 70 ensures the visual
   hide paints in one frame; `display: none` is unaffected by transitions
   in standards-mode so this is belt-and-braces.
5. **Optimistic-UI border/background transitions** —
   `transition-duration: 0.01ms` paints the final-state color cue
   without motion. Verified matches the minimum-duration rule.

`grep -cE 'prefers-reduced-motion' feedback-inline-mobile.html` returns 1.

### Gate 3 — §10.audit section in motion-and-reduced-motion-spec.md

**PASS.** Lines 58-87 of `motion-and-reduced-motion-spec.md` carry the
section, titled **"§10.audit — Stage-wide reduced-motion audit (canonical,
FB-86, unit-25)"**. The section:

- Explains why the earlier `@keyframes`-only script (lines 46-56) missed
  FB-86 — transitions and Tailwind animation utilities (`animate-pulse`,
  `animate-spin`) were not covered.
- Contains the exact widened shell script (lines 68-80) matching the
  unit spec.
- States "Expected output: empty. Any MISSING line is a failure."
- Carries a scope note (lines 82-87) explicitly saying the audit is run
  stage-wide, not per-artifact-input, and cites unit-21's contrast-audit
  scope-widening as the precedent.

### Gate 4 — §10.rule minimum-duration-not-none

**PASS.** Lines 89-134 carry the section **"§10.rule — Minimum-duration,
not none"**. The section:

- Shows the canonical guard form using `0.01ms` durations.
- Explains why `0.01ms` and not `none`/`0`/`initial` — four concrete
  state cues whose final frame MUST paint (FAB chevron rotation, toggle
  thumb slide, sheet `hidden` toggle, optimistic-UI border flip).
- Calls out `animation: none` as a per-component exception for
  decoration-only animations (FAB pulse, sheet slide-in, toast slide-in),
  citing `feedback-inline-mobile.html` as the reference implementation.
- Closes with a clear rule summary — author-level defaults (`0.01ms`)
  plus per-component `animation: none` overrides for purely decorative
  motion.

## Reviewer-focus checks

- **State coverage** — the four state-conveying transitions the spec
  calls out (aria-expanded, aria-checked, hidden-class, optimistic-UI)
  all retain their final-frame paint under the `0.01ms` rule. No state
  cue is lost. No empty/loading/error state in the six guarded artifacts
  becomes invisible in reduced-motion mode.
- **Accessibility** — WCAG 2.3.3 (Animation from Interactions, AAA) and
  2.2.2 (Pause, Stop, Hide, A) are addressed by the spec header
  references. The spinner-replacement rule (lines 39) pairs reduced-motion
  with a visible text label for in-flight operations — this is the
  correct way to satisfy 2.2.2 without a non-animated signal.
- **Design-system consistency** — guards use named tokens where possible
  (`!important` is used defensively, as standard for reduced-motion
  overrides). No raw hex; no bespoke animation timing. The minimum-
  duration rule is consistent across all six guarded files.
- **Responsive behavior** — the guard is a top-level `@media` block at
  the `reduce` preference, independent of viewport width. Confirmed by
  inspection of `feedback-inline-mobile.html` (375px viewport) and
  `review-package-structure.html` (desktop-oriented) — guard applies at
  all breakpoints.
- **Cross-reference against existing design system** — the
  `focus-ring-spec.html` already had a per-component `.fb-flash` /
  `.unit-flash` guard (audit table row 12); that guard was not modified
  and continues to function. `revisit-modal-states.html` was already
  guarded by the designer prior to this unit (3 guards) and remains
  intact.

## Anti-pattern checks

- **"MUST NOT approve without checking state coverage"** — confirmed
  state coverage preserved under the `0.01ms` rule.
- **"MUST NOT ignore accessibility requirements"** — spec cites WCAG
  2.3.3 and 2.2.2 explicitly; spinner-replacement rule addresses the
  non-animated signal requirement.
- **"MUST verify responsive behavior at all breakpoints"** — the
  `@media (prefers-reduced-motion: reduce)` block is orthogonal to
  viewport-width breakpoints; verified guards apply across mobile/tablet/
  desktop samples in the set.
- **"MUST NOT accept raw hex values — named tokens REQUIRED"** — the
  guards themselves use only `0.01ms`, `!important`, and `none` — no
  color values. Named tokens N/A for this unit's scope.
- **"MUST cross-reference component usage against the existing design
  system"** — verified the guard pattern is consistent with the pre-
  existing `.fb-flash` guard in `focus-ring-spec.html` and with
  `revisit-modal-states.html`'s per-component guards.

## Verdict

**Approved.** All four quality gates pass. No consistency issues, no
missing states, no accessibility gaps. Advancing hat.
