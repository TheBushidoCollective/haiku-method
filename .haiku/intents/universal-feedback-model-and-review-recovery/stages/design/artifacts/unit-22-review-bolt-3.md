# Unit-22 design-reviewer — Bolt 3

**Verdict:** APPROVE (re-approval after feedback-assessor bolt-2 reject loop).

## Context

Bolt 2 designer authored `aria-landmark-spec.md §3.7` + the head-of-document
a11y pointer in `feedback-inline-mobile.html`. Bolt 2 reviewer approved.
Feedback-assessor then rejected the unit back to designer at bolt 3. No
designer commit landed on the unit branch between that reject and this
reviewer invocation — the artifacts currently on-branch are identical to the
bolt-2 approved state.

Per the design-reviewer hat contract, the job is to check the artifacts
against the unit's completion criteria and `aria-landmark-spec.md §3.7 / §9`
grep contracts as they stand now.

## Checks re-run on bolt 3

All grep contracts from `aria-landmark-spec.md §3.7` and §9 pass against the
current tree:

- `grep -cE 'role="dialog"|aria-modal|aria-labelledby' stages/design/artifacts/revisit-modal-states.html` → **8** (expected ≥ 8; error + loading + empty + long-content × 2 attrs each).
- `grep -nE 'main\.inert|setAttribute\(.aria-hidden' stages/design/artifacts/feedback-inline-mobile.html` → **5 matches** (comment + open path × 2 attrs + close path × 2 attrs — covers open *and* close lifecycles).
- `grep -nE 'aria-landmark-spec\.md §3\.7' stages/design/artifacts/feedback-inline-mobile.html` → **4 matches** (head-of-document pointer + inline references in body and script).
- `grep -nE 'aria-landmark-spec\.md §3\.7' stages/design/artifacts/revisit-modal-states.html` → **1 match** (§Modal lifecycle citation).

## Dialog-contract coverage in revisit-modal-states.html

Each modal shell carries the full contract and has a matching heading id:

| Shell | Container attributes | Heading id |
|---|---|---|
| Error | `role="dialog" aria-modal="true" aria-labelledby="revisit-states-error-title" aria-describedby="revisit-states-error-desc"` | `<h3 id="revisit-states-error-title">` |
| Loading | same + `aria-busy="true"` + `aria-labelledby="revisit-states-loading-title"` | `<h3 id="revisit-states-loading-title">` |
| Empty | `aria-labelledby="revisit-states-empty-title"` | `<h3 id="revisit-states-empty-title">` |
| Long-content | `aria-labelledby="revisit-states-long-title"` | `<h3 id="revisit-states-long-title">` |

State matrix table for inert + aria-hidden contract is present at line 341
(cheat-sheet) and line 714 (coverage summary).

## feedback-inline-mobile.html wiring

- FAB (`id="feedback-fab"`) has `aria-haspopup="dialog" aria-expanded="false"
  aria-controls="feedback-sheet" data-feedback-sheet-trigger`. No inline
  `onclick` for the sheet.
- Close button carries `data-feedback-sheet-close` marker. No inline `onclick`.
- Sheet root (`#feedback-sheet`) renders `role="dialog" aria-modal="true"
  aria-labelledby="sheet-title"` and starts with the `hidden` attribute.
- `<script data-feedback-sheet-controller>` block at line 410 wires
  `openSheet` / `closeSheet` / Escape listener / focus flow, and applies the
  inert + aria-hidden pair to `<main>` and `<header role="banner">` on open
  and reverses both on close — exactly the §3.7 contract.
- The only remaining inline `onclick` in the artifact is the theme toggle at
  line 104 (out of scope — separate concern, no dialog/inert interaction).
- Head-of-document comment points at `aria-landmark-spec.md §3.7` so dev-stage
  inherits the full contract, not a TODO comment.

## Completion criteria status

All seven criteria in `unit-22-modal-dialog-semantics-and-inert-contract.md`
remain satisfied; none regressed from the bolt-2 state. FB-74 and FB-80 are
both addressed in artifact markup.

## Verdict

APPROVE. Re-advance to feedback-assessor so assessor's bolt-3 re-check runs
against the same artifact state the reviewer just validated. If assessor
again rejects, the blocker is in assessor scope (e.g. gate-spec disagreement
or cross-artifact leakage), not designer output for this unit.
