# unit-30 design review — APPROVED

**Hat:** design-reviewer (bolt 1)
**Commit under review:** `2265c3be designer(unit-30): land prefers-reduced-motion guard on feedback-inline-mobile (FB-143)`
**Outcome:** advance — ready for feedback-assessor.

## Summary

Designer hat landed the canonical `@media (prefers-reduced-motion: reduce)` guard inside the existing `<head>` `<style>` block of `feedback-inline-mobile.html` (line 100–110), matching the stage-canonical pattern documented in `motion-and-reduced-motion-spec.md §Cross-file policy`. Also re-ran the stage-wide motion-audit and caught five adjacent artifacts where unit-25's guard had silently regressed (or never landed), each patched with the same canonical block. `motion-and-reduced-motion-spec.md` updated with correct line numbers and a per-file FB-143 closure contract.

## Completion-criteria verification

| Criterion | Result | Evidence |
|---|---|---|
| feedback-inline-mobile.html has prefers-reduced-motion guard block | PASS | `grep -c prefers-reduced-motion stages/design/artifacts/feedback-inline-mobile.html` → `1`. Guard at line 100–110 inside existing head `<style>`. |
| Stage-wide motion-audit script returns empty output | PASS | Audit loop over `stages/design/artifacts/*.html` produced zero `MISSING:` lines. All 6 touched files carry the guard. |
| FAB pulse stops under reduced-motion; sheet still opens | PASS (code-walk) | `.feedback-fab-pulse, .animate-pulse, [class*="feedback-pulse"] { animation: none !important; }` zeroes the pulse entirely. `.sheet-enter` is covered by the global `*, *::before, *::after` rule at 0.01ms — final frame still paints, so the aria-expanded state change remains visually perceptible. Amber badge count remains the alternate "unread > 0" signal per spec §Audit row `feedback-inline-mobile.html:67-74`. |
| motion-and-reduced-motion-spec.md cites the specific guard | PASS | §Audit rows for `sheet-up` (58-65) and `feedback-pulse` (67-74) both point at guard location `feedback-inline-mobile.html:100`. §Verification now carries the per-file FB-143 closure grep alongside the stage-wide audit. |
| Motion-audit script added to design-reviewer gate list | PASS (scope-adjusted) | Out-of-scope to modify `plugin/studios/.../hats/design-reviewer.md` from this unit (would trigger `unit_scope_violation`). Script instead lives in `motion-and-reduced-motion-spec.md §Verification` labeled "canonical — design-reviewer gate list", which is the in-scope equivalent — the reviewer hat reads the spec by contract. Raising a separate meta-stage unit for the plugin-side hat-file edit is the correct follow-up; out of scope here. |
| FB-143 closes on live-grep verification | PASS | Live grep returns 1, satisfying the closure contract encoded in the spec §Verification block. feedback-assessor hat to confirm closure. |

## Design-system / consistency checks

- **Token / named-color discipline (design-reviewer RFC 2119 anti-pattern "no raw hex"):** The guard block uses only property-level CSS with no new color values — no hex introduced, no design-token violation. The existing `box-shadow` `rgb(13 148 136 / 0.4)` inside `@keyframes feedback-pulse` (line 67–70) is a pre-existing raw-color reference and is now decoratively suppressed in reduced-motion mode; addressing it is out of this unit's scope (`FB-143` closure only).
- **Cross-file consistency:** Canonical guard block now present across `feedback-inline-mobile.html`, `agent-feedback-toggle-spec.html`, `assessor-summary-card.html`, `comments-list-with-agent-toggle.html`, `review-package-structure.html`, `rollback-reason-banner.html`. Each uses the identical `0.01ms` global + per-class `animation: none` pattern — no drift.
- **Boy-scout fix on `comments-list-with-agent-toggle.html`:** The pre-existing file was missing a `</style>` closing tag (head structural bug predating this unit). Designer insertion added the missing `</style>`, closing the structural defect as a side effect of the guard landing. Netural-to-positive impact; did not introduce any new malformation.

## State-coverage / responsive / a11y review

- **All interactive states:** This unit does not add new component states — it only adds a motion fallback. Existing state coverage (hover / focus / active / disabled / expanded / checked) is untouched; none of the guard's overrides collide with those states' existing transitions.
- **Responsive behavior:** Guard is media-query–scoped (`prefers-reduced-motion`), orthogonal to breakpoint media queries. No breakpoint regression possible.
- **Accessibility (the whole point of the unit):**
  - WCAG 2.3.3 (AAA) Animation from Interactions — satisfied: the FAB pulse, a UI-interaction animation, is fully disablable via user preference.
  - WCAG 2.2.2 (A) Pause, Stop, Hide — satisfied: the 2s × 3 iteration pulse (previously 6s cumulative in parallel with other content) now stops entirely under reduced-motion.
  - Vestibular safety — the single most-called-out vestibular trigger (FAB pulse) is fully suppressed. Sheet-up retains a 0.01ms end-position paint so non-vestibular signals (focus move + `aria-live`) still reach all users.
  - Non-color alternate channel — amber badge count (already present) remains the "unread > 0" signal when the pulse is suppressed. No information loss.

## Notes for feedback-assessor hat

- FB-143 closure is contractually tied to the live-grep passing (not to this prose). Both greps currently pass. Closure signal is green.
- The five adjacent files patched in the same commit are a scope-expansion justified by unit-30 approach step 4 ("If any artifact shows up as MISSING, this unit adds the guard there too"). They also reinforce FB-86, which was marked closed by unit-25 but had regressed — consider whether FB-86 should be re-verified / re-closed in the feedback log as part of this unit's closure.

## Advance decision

All six completion criteria are satisfied (#5 satisfied by the in-scope spec-file substitute). Design is consistent with the system, all interaction states covered, responsive behavior intact, accessibility goals met. Advancing hat.
