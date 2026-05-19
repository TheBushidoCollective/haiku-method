# Draft Stage — Execution

## Per-unit baton (`drafter → editor → verifier`)

Every draft unit walks the three hats in order. The baton across the rally race is the unit's `DRAFT-DOCUMENT.md` accumulating on disk:

1. **`drafter` (plan / do for clauses):** Reads the intake brief, the research memo, and any confirmed strategic choices the attorney made on the memo's options. Drafts the operative provisions — recitals, definitions, operative clauses, boilerplate, exhibits — mapping each clause back to a brief requirement or a risk-inventory entry. Flags interpretive choices for attorney review rather than burying them in the body.
2. **`editor` (do for consistency):** Reads the drafter's body and tightens it for defined-term discipline, cross-reference accuracy, structural consistency, and exhibit completeness. Surfaces (does not silently fix) substantive inconsistencies — a clause that contradicts another, a recital that asserts a fact the operative clauses contradict, a defined term that breaks in usage.
3. **`verifier` (verify):** Reads the unit body and confirms it answers the design brief, traces to upstream inputs, is internally coherent, and aligns with the decision register. Calls `haiku_unit_advance_hat` on pass; `haiku_unit_reject_hat` if a gap remains.

The hat order is `plan → do → verify` because drafting produces the substantive deliverable, editing tightens it, and verification confirms the unit is ready for the review stage's adversarial lens.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `precision` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `precision` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → drafter → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `drafter` is the implementer (re-authors the affected clause); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. The licensed attorney approves the draft locally before the review stage opens. The attorney's approval at this gate signals "the draft is ready for substantive review," not "the draft is ready to execute."

## Reviewer guidance specific to this stage

When the `precision` review agent or a human reviewer reads the stage's output:

- **Defined-term drift** is the single highest-priority finding — a term used inconsistently or used before it's defined creates clauses with two different meanings, and reviewers downstream pick differently.
- **Missing brief requirements** are next — a requirement in `LEGAL-BRIEF.md` with no addressing clause is a coverage gap.
- **Risks without protective clauses** — a risk in the inventory with no addressing provision is either a deliberate acceptance (which the attorney must explicitly waive) or a coverage gap.
- **Unbounded ambiguity** — `reasonable`, `material`, `from time to time` without scoping language create disputes; flag them.
- **Operative obligations in recitals** are a structural defect; recitals state context, not bind the parties.
