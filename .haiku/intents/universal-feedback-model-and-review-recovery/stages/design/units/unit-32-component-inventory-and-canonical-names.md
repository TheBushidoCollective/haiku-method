---
title: >-
  Component-inventory consistency — add RollbackBanner, BlockedGatePanel,
  RollbackToast rows to DESIGN-BRIEF §2 + state-coverage-grid §0 +
  component-inventory.md. Canonicalize FeedbackSheet as the single name
  (drop every MobileFeedbackPanel reference). Unblocks dev stage from
  having to guess canonical names from filenames
type: design
closes:
  - FB-142
  - FB-147
depends_on:
  - unit-31-feedback-list-semantics-parity
inputs:
  - stages/design/
outputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/component-inventory.md
  - stages/design/artifacts/aria-landmark-spec.md
  - stages/design/artifacts/unit-32-design-review.md
quality_gates:
  - name: design-brief-has-rollback-banner
    command: "grep -E 'RollbackBanner' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/DESIGN-BRIEF.md"
  - name: design-brief-has-blocked-gate-panel
    command: "grep -E 'BlockedGatePanel' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/DESIGN-BRIEF.md"
  - name: design-brief-has-rollback-toast
    command: "grep -E 'RollbackToast' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/DESIGN-BRIEF.md"
  - name: state-coverage-checklist-has-rollback-trio
    command: "python3 -c \"import sys; c = open('.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/state-coverage-grid.md').read(); names = ['RollbackBanner', 'BlockedGatePanel', 'RollbackToast']; missing = [n for n in names if n not in c]; sys.exit(1 if missing else 0)\""
  - name: component-inventory-has-rollback-trio
    command: "python3 -c \"import sys; c = open('.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/component-inventory.md').read(); names = ['RollbackBanner', 'BlockedGatePanel', 'RollbackToast']; missing = [n for n in names if n not in c]; sys.exit(1 if missing else 0)\""
  - name: no-mobile-feedback-panel-in-stage
    command: "! grep -rEn 'MobileFeedbackPanel' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/ .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/DESIGN-BRIEF.md .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/knowledge/"
---
# Component-inventory and canonical-name consistency

## Scope

Two consistency defects with a shared root: component identity drift
between spec, inventory, and grid.

- **FB-142** — Three live components (`RollbackBanner`,
  `BlockedGatePanel`, `RollbackToast`) render in `rollback-reason-
  banner.html` and `revisit-modal-states.html` with state-coverage-grid §4
  rows describing their states. But none appear in DESIGN-BRIEF §2 "New
  Components" nor in state-coverage-grid §0 checklist. Dev stage has
  nothing to name these components from in the spec — they're "ghost"
  components.
- **FB-147** — DESIGN-BRIEF §2 ships three mutually contradictory
  statements about the mobile bottom-sheet canonical name:
  - L119: `FeedbackSheet (aka MobileFeedbackPanel)` — implies aliases.
  - L597 Retired-row: `MobileFeedbackSheet ... superseded by unified
    MobileFeedbackPanel inside the bottom sheet` — rationale says
    MobileFeedbackPanel is canonical, but the "Replaced by" column says
    `FeedbackSheet`. Internally inconsistent.
  - L917 (§9 File Inventory): `review-app/src/components/FeedbackSheet.tsx
    | New` — pins FeedbackSheet.tsx as the canonical file name.

Both lists (DESIGN-BRIEF §2 and state-coverage-grid §0) already carry
cross-reference invariants — the state-coverage-grid §0 callout explicitly
says "every new component in §2 MUST have a grid row", and FB-56 extension
says the reverse too. Both are violated.

## Approach

**Designer hat:**

1. **DESIGN-BRIEF §2 New Components** — add 3 rows after `RevisitModal`.
   Each row follows the existing schema (name, noun phrase, render surface
   pointer, props summary, FSM tie-in). Source content already exists in
   rollback-reason-banner.html / revisit-modal-states.html / state-
   coverage-grid §4; this is just cross-reference work, not new design.
2. **state-coverage-grid.md §0 checklist** — extend from 12 rows to 15,
   each pointing at the §row where state coverage is documented.
   RollbackToast already has §4 coverage; RollbackBanner + BlockedGatePanel
   need brief §row additions (or pointers to rollback-reason-banner.html
   sections).
3. **component-inventory.md "New Components"** — add 3 mirroring rows,
   thin pointers matching existing 12.
4. **FeedbackSheet canonicalization** — choose `FeedbackSheet` as the
   canonical name (matches §9 File Inventory and the "Mobile prefix
   redundant" rationale). Sweep every `MobileFeedbackPanel` reference:
   - DESIGN-BRIEF §2 L119, L597, L810.
   - state-coverage-grid.md §0 L22.
   - aria-landmark-spec.md §5.
   - Any artifact prose (check with stage-wide grep).
5. **Upstream-finding note** — unit-19 and unit-20 cite
   `MobileFeedbackPanel`; those units are completed and immutable. Add a
   design-reviewer pointer to DESIGN-BRIEF §2 (near the retired-components
   list) documenting: "Upstream units 19, 20 prose cites the retired name
   `MobileFeedbackPanel`; dev stage treats `FeedbackSheet` as
   authoritative per §9 File Inventory." This is a file-annotation, not
   a modification to the completed units.

**Design-reviewer hat:**

- Run the `MobileFeedbackPanel` grep → 0 hits on artifacts and DESIGN-BRIEF.
- Walk DESIGN-BRIEF §2 and state-coverage-grid §0 checklist — counts
  must match (15 each).
- Spot-check each new §2 row matches the schema of the existing 12 rows.

**Feedback-assessor hat:**

- Run the MobileFeedbackPanel grep.
- Cross-reference count of DESIGN-BRIEF §2 vs state-coverage-grid §0.
- FB-142, FB-147 close on live-grep + list-count verification.

## Completion criteria

- [ ] DESIGN-BRIEF §2 lists 15 new-component rows (+3 for rollback trio)
- [ ] state-coverage-grid §0 checklist has 15 rows
- [ ] component-inventory.md New Components has 3 mirroring rows
- [ ] MobileFeedbackPanel grep on artifacts + DESIGN-BRIEF → 0
- [ ] Upstream-finding note for unit-19/20 prose added to DESIGN-BRIEF §2
- [ ] FB-142, FB-147 close on live-grep verification
