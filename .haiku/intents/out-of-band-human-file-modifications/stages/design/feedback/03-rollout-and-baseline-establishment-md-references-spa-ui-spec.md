---
title: >-
  ROLLOUT-AND-BASELINE-ESTABLISHMENT.md references SPA-UI-SPECS.md which is not
  in the design artifact set
status: closed
origin: adversarial-review
author: design-reviewer
author_type: agent
created_at: '2026-04-28T20:22:46Z'
iteration: 1
visit: 1
source_ref: null
closed_by: unit-06-rollout-chip-self-contained
bolt: 0
triaged_at: '2026-04-28T20:22:46Z'
resolution: null
replies: []
---

## Finding

Section 4.3 of `ROLLOUT-AND-BASELINE-ESTABLISHMENT.md` states:

> "The indicator is a chip-class indicator consistent with the other status chips defined in SPA-UI-SPECS.md."

`SPA-UI-SPECS.md` is not listed as a design artifact in this intent, is not referenced in `ARCHITECTURE.md` or `TRACKED-SURFACE-BOUNDARY.md`, and does not appear in the intent's knowledge or artifact directories. The reference creates an undeclared dependency for the development stage implementing the "drift detection initializing" chip.

## Impact

If `SPA-UI-SPECS.md` does not exist, the development stage has no authoritative chip-class definition to implement against for the establish-mode indicator. The indicator may be implemented inconsistently with other SPA status chips, or the development stage may need to make a deferred decision that belongs in design.

## Recommended Resolution

One of the following:

1. **If SPA-UI-SPECS.md exists elsewhere in the intent or plugin artifact set**: add an explicit cross-reference with the path so the development stage can locate it.
2. **If SPA-UI-SPECS.md does not yet exist**: replace the reference with an inline description of the chip style (e.g., "a passive informational chip using the same visual treatment as the `external review pending` status chip on the stage card") that the development stage can implement without a missing dependency.
3. **If chip styling is intentionally deferred**: say so explicitly — "chip styling is deferred; the indicator is a text label in a neutral container; design system integration is a follow-up."

The rollout spec is otherwise complete and sound. This is a localized reference gap, not a structural problem with the document.
