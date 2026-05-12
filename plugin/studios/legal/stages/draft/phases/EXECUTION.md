# Draft Stage — Execution

## Per-unit baton (`drafter → editor → verifier`)

Every draft unit walks the three hats in order. The baton across the rally race is the unit's `DRAFT-DOCUMENT.md` accumulating on disk:

1. **`drafter` (plan / do for clauses):** Reads the intake brief, the research memo, and any confirmed strategic choices the attorney made on the memo's options. Drafts the operative provisions — recitals, definitions, operative clauses, boilerplate, exhibits — mapping each clause back to a brief requirement or a risk-inventory entry. Flags interpretive choices for attorney review rather than burying them in the body.
2. **`editor` (do for consistency):** Reads the drafter's body and tightens it for defined-term discipline, cross-reference accuracy, structural consistency, and exhibit completeness. Surfaces (does not silently fix) substantive inconsistencies — a clause that contradicts another, a recital that asserts a fact the operative clauses contradict, a defined term that breaks in usage.
3. **`verifier` (verify):** Reads the unit body and confirms it answers the design brief, traces to upstream inputs, is internally coherent, and aligns with the decision register. Calls `haiku_unit_advance_hat` on pass; `haiku_unit_reject_hat` if a gap remains.

The hat order is `plan → do → verify` because drafting produces the substantive deliverable, editing tightens it, and verification confirms the unit is ready for the review stage's adversarial lens.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `precision` review agent fires, checking defined-term discipline, cross-reference resolution, brief-to-clause and risk-to-clause traceability, and operative ambiguity.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, drafter, feedback-assessor]` dispatches per finding. Classifier routes; drafter re-authors the affected clause; assessor closes.
4. **Gate** — The gate is `ask`. The licensed attorney approves the draft locally before the review stage opens. The attorney's approval at this gate signals "the draft is ready for substantive review," not "the draft is ready to execute."

## Reviewer guidance specific to this stage

When the `precision` review agent or a human reviewer reads the stage's output:

- **Defined-term drift** is the single highest-priority finding — a term used inconsistently or used before it's defined creates clauses with two different meanings, and reviewers downstream pick differently.
- **Missing brief requirements** are next — a requirement in `LEGAL-BRIEF.md` with no addressing clause is a coverage gap.
- **Risks without protective clauses** — a risk in the inventory with no addressing provision is either a deliberate acceptance (which the attorney must explicitly waive) or a coverage gap.
- **Unbounded ambiguity** — `reasonable`, `material`, `from time to time` without scoping language create disputes; flag them.
- **Operative obligations in recitals** are a structural defect; recitals state context, not bind the parties.
