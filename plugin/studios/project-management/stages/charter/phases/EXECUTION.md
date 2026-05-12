# Charter Stage — Execution

## Per-unit baton (`sponsor → scoper → verifier`)

Every charter unit walks the three hats in order. The baton across the rally race is the unit's own outputs accumulating in `PROJECT-CHARTER.md`:

1. **`sponsor` (plan):** Reads the elaboration's captured agreement, the user's business context, and any prior charters that inform the governance pattern. Writes the business case, success criteria (metric + target + measurement method + owner), and governance structure (sponsor, decision rights, escalation path, change-control threshold). Hands off when the business case is concrete, success criteria are measurable, and governance names a single accountable sponsor.
2. **`scoper` (do):** Reads the sponsor's sections. Writes explicit in-scope items (decomposable), explicit out-of-scope items (with rationale), constraints (with sources), assumptions (with owners and falsification triggers), and the stakeholder map (with interest / influence / position / engagement per stakeholder). Hands off when scope is bounded on both sides, constraints and assumptions are sourced, and every stakeholder has an engagement plan.
3. **`verifier` (verify):** Reads the unit's full body. Checks substance, citation, internal consistency, and decision-register accountability per the verifier mandate. Either advances (body passes) or rejects with the failing criterion named (rewinds to the responsible hat within the current unit).

The hat order is `plan → do → verify` because the business case and success criteria frame what scope and stakeholder engagement need to deliver against. Working scope before business case inverts the dependency.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's `feasibility` review agent and any studio-level review agents fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The `fix_hats: [classifier, sponsor, feedback-assessor]` chain dispatches per finding. Classifier routes the FB; `sponsor` re-authors the relevant section (business case, criteria, governance, scope, constraints, assumptions, stakeholders depending on classification); the assessor independently decides closure.
4. **Gate** — The gate is `external` — sponsor sign-off typically happens outside the plugin (a signed charter document, a kickoff approval recorded in the PM tool). The branch-merge signal advances the stage once external approval is recorded.

## Reviewer guidance specific to this stage

- **Subjective success criteria** are the highest-priority finding. A success criterion without metric / target / method is unverifiable at close time and undermines every later stage's "are we on track?" conversation.
- **Implicit decision rights** are the next priority. The first time a real decision needs to be made, the team will discover the governance gap — and the gap will cost more then than now.
- **Single-sided scope** (in-scope listed, out-of-scope missing) almost guarantees scope debate downstream. Push for the explicit exclusions.
- **Unsourced constraints** are folklore. Without a named source, they can't be revisited when conditions change.
