# Intake Stage — Execution

## Per-unit baton (`paralegal → risk-assessor`)

Every intake unit walks the two hats in order. The baton across the rally race is the unit's slice of `LEGAL-BRIEF.md` accumulating on disk:

1. **`paralegal` (plan / do for facts):** Reads the unit's success criteria and the user's initial intake conversation. Captures the fact pattern — parties, jurisdictions, governing law candidates, existing documents, business context — into a structured brief with cited sources. Hands off when the fact record is complete and every non-trivial claim has a named source.
2. **`risk-assessor` (do / verify):** Reads the paralegal's record and walks the standard risk categories (regulatory, contractual, IP, indemnity, confidentiality, dispute, reputational, operational). Builds the risk inventory with likelihood / impact tags and generic mitigation options framed for the licensed attorney's evaluation. Surfaces deal-blockers in an explicit escalation section. Calls `haiku_unit_advance_hat` when the inventory traces back to the fact pattern and is internally consistent; `haiku_unit_reject_hat` if the fact record is too thin to assess.

The hat order is `plan → do` because the fact record IS the plan — the risk-assessor's analysis derives from it. There is no separate verifier hat in this stage; the second hat carries both the do and verify responsibility for the unit's deliverable, which is why the rejection routing matters.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `completeness` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `completeness` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → paralegal → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `paralegal` is the implementer (re-authors the affected section — or escalates if the gap is risk-side); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Intake findings are typically internal-record findings (a fact uncited, a jurisdiction omitted) that resolve without a separate human approval gate beyond verifier sign-off.

## Reviewer guidance specific to this stage

When the `completeness` review agent or a human reviewer reads the stage's output:

- **Risks pulled from a generic template** is the single highest-priority finding — every risk must trace to a specific trigger fact, not to a generic prior. A boilerplate risk inventory hides the matter's real exposure.
- **Unsourced facts** are next — uncited claims become disputed facts at the draft and review stages, and the org has no defensible record.
- **Missing jurisdictions** is critical — every jurisdiction the matter touches (place of performance, counterparty HQ, governing-law candidate, dispute venue) must be named with reasoning.
- **Buried deal-blockers** — a risk that would block the deal if unresolved must be in an `## Attorney Escalation` section, not in a table row.
