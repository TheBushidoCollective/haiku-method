# Analysis Stage — Execution

## Per-unit baton (`analyst → auditor`)

Every analysis unit walks the two hats in `plan+do → verify` order:

1. **`analyst` (plan + do):** Reads the upstream budget plan and forecast model. States granularity, comparison basis (budget vs. forecast vs. prior period), period, and materiality threshold up front. Calculates variances (dollar, percentage, direction). Classifies each material variance as structural / timing / operational. Attributes root cause with cited evidence. Recommends specific corrective action (owner, action, timing) for each material unfavorable operational variance. Adds multi-period trend context. Hands off when every material variance is classified, attributed, and matched to a recommendation.
2. **`auditor` (verify):** Cross-checks data sources against the analyst's totals. Verifies methodology consistency (one materiality threshold, one comparison basis, one period definition). Confirms root-cause attributions cite real evidence. Validates classification fit against evidence. Either advances (`haiku_unit_advance_hat`) or rejects naming the specific failed criterion (`haiku_unit_reject_hat`).

This stage is plan-do-combined / verify because the analyst's planning (granularity, basis, materiality) and doing (calculation, classification, attribution, recommendation) are tightly coupled — separating them would split a single thought process. The auditor's independent verification preserves the rally-race semantics.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `accuracy` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `accuracy` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → analyst → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `analyst` is the implementer (re-runs the calculation or re-attributes the root cause); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Substantive human review happens at the next stage (`reporting`), where the variance report becomes stakeholder-facing.

## Reviewer guidance specific to this stage

- **A variance classified operational when the evidence indicates a permanent business-shape change** is the highest-priority misclassification — the resulting corrective action won't fit the actual problem (you can't operationally fix a structural shift).
- **A material favorable variance ignored** often signals budget padding, scope miss, or a leading indicator of an upcoming problem. Don't treat the report as "explain the misses".
- **Inconsistent materiality across departments** in the same report is a bias signal — the analyst is implicitly weighting some areas more critically than others.
- **A corrective recommendation without owner and timing** is non-actionable — surface it as a finding even if everything else about the analysis is sound.
