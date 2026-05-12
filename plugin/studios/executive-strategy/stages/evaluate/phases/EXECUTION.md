# Evaluate Stage — Execution

## Per-unit baton (`evaluator → risk-analyst → verifier`)

Every evaluate unit walks the three hats in order:

1. **`evaluator` (plan):** Reads the options matrix and landscape analysis. Locks criteria, weights, and scoring scale BEFORE scoring any option. Scores each (option × criterion) cell with reasoning citing specific upstream evidence and a confidence rating. Publishes composite + unweighted breakdown. Names dominated options and real tradeoff pairs. Hands off when the matrix is complete and the tradeoff structure is visible.
2. **`risk-analyst` (do):** Reads the evaluator's matrix and the options stage's killer assumptions. For each option, lists top risks (trigger, probability with reasoning, quantified impact, time horizon), stress-tests the killer assumptions, models adverse scenarios (typically bull / base / bear), and names mitigations with feasibility checks. Hands off when every option has stressed killers, scenario outcomes, and feasibility-checked mitigations.
3. **`verifier` (verify):** Reads the unit body. Checks substance, citation, internal consistency, and decision-register accountability. Either advances or rejects with the responsible hat named.

The hat order is `plan → do → verify` because scoring criteria must be locked before scoring; reversing produces a fraudulent evaluation.

## After execute completes

When every unit's hat chain has terminal-advanced:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `objectivity` review agent fires alongside any studio-level review agents.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, evaluator, feedback-assessor]` dispatches per finding. The classifier routes the FB. `evaluator` is the implementer (re-scoring or re-documenting reasoning; weight changes require redoing the scoring with the new weights documented). The assessor independently decides closure.
4. **Gate** — The stage's gate is `ask` — local human approval. Decision quality depends on evaluation transparency; the user must inspect criteria weighting and scenario assumptions before the decision stage locks in.

## Reviewer guidance specific to this stage

- **Post-hoc weight adjustment** is the single highest-priority finding — it turns evaluation into rationalization. If any signal suggests weights moved after scoring began, that's a fix-loop finding before anything else.
- **Composite-only scoring** is next — without the unweighted breakdown, reviewers can't see where the answer comes from and the decision stage can't engage with the tradeoffs.
- **Soft bear cases** — scenarios that are 10% worse than base across the board don't stress the analysis. Real bear cases reflect plausible adverse conditions the landscape named.
- **Identical risk profiles across options** — when risk lists look the same in shape across every option, the analysis didn't actually differentiate; it just templated.
- **Aspirational mitigations** — mitigations without feasibility checks are not mitigations; flag the underlying risk as unmitigated.
