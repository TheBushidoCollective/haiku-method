# Intake Stage — Execution

## Per-unit baton (`paralegal → risk-assessor`)

Every intake unit walks the two hats in order. The baton across the rally race is the unit's slice of `LEGAL-BRIEF.md` accumulating on disk:

1. **`paralegal` (plan / do for facts):** Reads the unit's success criteria and the user's initial intake conversation. Captures the fact pattern — parties, jurisdictions, governing law candidates, existing documents, business context — into a structured brief with cited sources. Hands off when the fact record is complete and every non-trivial claim has a named source.
2. **`risk-assessor` (do / verify):** Reads the paralegal's record and walks the standard risk categories (regulatory, contractual, IP, indemnity, confidentiality, dispute, reputational, operational). Builds the risk inventory with likelihood / impact tags and generic mitigation options framed for the licensed attorney's evaluation. Surfaces deal-blockers in an explicit escalation section. Calls `haiku_unit_advance_hat` when the inventory traces back to the fact pattern and is internally consistent; `haiku_unit_reject_hat` if the fact record is too thin to assess.

The hat order is `plan → do` because the fact record IS the plan — the risk-assessor's analysis derives from it. There is no separate verifier hat in this stage; the second hat carries both the do and verify responsibility for the unit's deliverable, which is why the rejection routing matters.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent confirms the stage's brief and risk inventory conform to the intent's spec.
2. **Quality review (parallel)** — The stage's `completeness` review agent fires, checking party identification, jurisdictional coverage, fact sourcing, risk tagging, and attorney-escalation surfacing.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, paralegal, feedback-assessor]` dispatches per finding. Classifier routes the FB to the right unit; paralegal re-authors the affected section (or escalates if the gap is risk-side); assessor decides closure.
4. **Gate** — The gate is `auto`. Intake findings are typically internal-record findings (a fact uncited, a jurisdiction omitted) that resolve without a separate human approval gate beyond verifier sign-off.

## Reviewer guidance specific to this stage

When the `completeness` review agent or a human reviewer reads the stage's output:

- **Risks pulled from a generic template** is the single highest-priority finding — every risk must trace to a specific trigger fact, not to a generic prior. A boilerplate risk inventory hides the matter's real exposure.
- **Unsourced facts** are next — uncited claims become disputed facts at the draft and review stages, and the org has no defensible record.
- **Missing jurisdictions** is critical — every jurisdiction the matter touches (place of performance, counterparty HQ, governing-law candidate, dispute venue) must be named with reasoning.
- **Buried deal-blockers** — a risk that would block the deal if unresolved must be in an `## Attorney Escalation` section, not in a table row.
