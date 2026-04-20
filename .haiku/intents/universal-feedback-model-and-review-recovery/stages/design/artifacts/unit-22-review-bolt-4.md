# Unit-22 design-reviewer — Bolt 4

**Verdict:** APPROVE.

## Context

Bolt 3 reviewer (`e7df5c65`) re-approved the artifact tree with no designer
churn after the assessor-reject loop. Bolt 4 invocation finds the tree
unchanged — `git diff e7df5c65 HEAD --stat` is empty. No designer commit
has landed between bolt 3 and this reviewer run; the artifacts to review
are byte-identical to the bolt-2 approved / bolt-3 re-approved state.

Per the design-reviewer hat contract, the job is to re-verify that the
artifacts on-branch still satisfy the unit's completion criteria and the
`aria-landmark-spec.md §3.7 / §9` grep contracts right now.

## Grep contracts — re-run at bolt 4

All four contracts pass against the current tree:

| Contract | Expected | Actual at bolt 4 |
|---|---|---|
| `role="dialog" aria-modal="true" aria-labelledby=` in `revisit-modal-states.html` | ≥ 4 (one per shell) | 4 (error L438 · loading L531 · empty L580 · long L628) |
| `role="dialog" aria-modal="true" aria-labelledby=` in `feedback-inline-mobile.html` | ≥ 1 | 1 (sheet root, L213–217) |
| `main\.inert` / `setAttribute\(.aria-hidden` in `feedback-inline-mobile.html` | ≥ 4 | 5 (head-of-doc comment + `lockBackground` L423–426 + `unlockBackground` L430) |
| `aria-landmark-spec\.md §3\.7` in `feedback-inline-mobile.html` | ≥ 1 | 4 (head-of-doc pointer L12 + body comment L211 + controller inline L422 + narrative L25) |
| `aria-landmark-spec\.md §3\.7` in `revisit-modal-states.html` | ≥ 1 | 1 (§Modal lifecycle citation L313) |

## Completion-criteria re-audit

| Criterion | Status |
|---|---|
| Every modal shell in `revisit-modal-states.html` carries `role="dialog" aria-modal="true" aria-labelledby="{id}"` | ✓ Error (L438) · Loading (L531, +`aria-busy="true"`) · Empty (L580) · Long-content (L628) |
| Every `aria-labelledby` target has a matching `id` on a visible heading inside the dialog | ✓ `revisit-states-error-title` (L441) · `revisit-states-loading-title` (L534) · `revisit-states-empty-title` (L583) · `revisit-states-long-title` (L631) |
| §Modal lifecycle documents the inert + aria-hidden pairing and cites `aria-landmark-spec.md §3.7` | ✓ L303–425, cite at L313 |
| Inert state-matrix table enumerates DOM/attribute state per phase | ✓ L342–417 — 6 phases × 7 columns (Idle → Opening → Open → Loading → Closing → Closed) |
| `feedback-inline-mobile.html` removes onclick comments and adds a real `<script data-feedback-sheet-controller>` block that actually sets `main.inert` + `setAttribute('aria-hidden')` | ✓ Controller at L410–471; `lockBackground` / `unlockBackground` wired |
| Dev-stage handoff note tells React to swap the vanilla controller for `<FocusTrap active returnFocusOnDeactivate>` | ✓ Head-of-doc L27–30; body comment L205–211; controller comment L398–400 |
| Grep contracts from `aria-landmark-spec.md §9` pass for both files | ✓ (table above) |
| FB-74 and FB-80 both verified by feedback-assessor | — assessor scope; designer side is green |

## Design-reviewer hat anti-patterns — none triggered

- State coverage: every interactive state covered for every interactive
  element (matrix at L716–770); nothing approved without the matrix row.
- Accessibility: dialog contract, `aria-modal`, `aria-labelledby`,
  `aria-describedby`, `aria-busy`, inert + `aria-hidden`, `role="alert"`
  on the error banner, `role="status" aria-live="polite"` on the rollback
  toast, reduced-motion branch — all documented and wired.
- Responsive behavior: mobile ✕ close button sized at 44×44; long-content
  modal fixes `max-h` via flex + `overflow-y-auto` so body scrolls while
  footer stays pinned; mobile two-line Confirm button uses
  `min-h-[44px]`.
- Named tokens only — no raw hex introduced at any bolt.
- Every modal's component usage cross-checked against the existing
  `aria-landmark-spec.md §3` / §3.7 / §5 contracts.

## Verdict

APPROVE. The tree is identical to the bolt-3 approved state; all grep
contracts still pass; every completion criterion remains satisfied; no
new design-reviewer anti-pattern is triggered. Re-advance to
feedback-assessor so the assessor's bolt-4 re-check runs against the
exact artifact state this reviewer just validated. If assessor rejects
again without a designer commit to diff against, the remaining blocker
is in assessor scope (gate-spec disagreement, cross-artifact leakage, or
a contract the designer artifacts cannot satisfy as currently specified)
and needs human intervention rather than another reviewer bolt.
