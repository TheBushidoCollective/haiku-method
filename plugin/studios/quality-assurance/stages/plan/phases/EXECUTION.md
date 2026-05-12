# Plan Stage — Execution

## Per-unit baton (`strategist → planner → verifier`)

Every plan unit walks the three hats in order. The baton is the unit body accumulating from strategy to logistics to validated artifact:

1. **`strategist` (plan):** Reads product / requirements context and Decisions. Writes the unit's scope, quality-dimension map, risk-based prioritization, and entry / exit criteria. Hands off when the strategy slice is complete, measurable, and consistent with sibling units.
2. **`planner` (do):** Reads the strategy section just written. Adds resource allocation, environment requirements, test data plan, sequencing dependencies, and plan-risk mitigation. Hands off when every strategy criterion has matching logistics and the dependency graph is a DAG.
3. **`verifier` (verify):** Validates the body for substance, citation, decision-register consistency, and open-questions accounting. Advances or rejects to the responsible hat. Does not edit the unit.

The hat order is `plan → do → verify` because the strategist's scope-and-risk is the plan; the planner's logistics is the do; the verifier's validation is the verify.

## After execute completes

When every unit's hat chain has terminal-advanced:

1. **Spec review (engine phase)** — Universal hard gate; built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — `coverage` review agent fires; produces feedback if the lens identifies a gap.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, strategist, feedback-assessor]` dispatches per FB. Classifier routes; `strategist` re-authors the affected strategy section; assessor decides closure.
4. **Gate** — `ask`. A human reviews the strategy locally and approves. The strategy frames every downstream stage, so the human gate is load-bearing.

## Reviewer guidance specific to this stage

When reading the stage's output:

- **Out-of-scope is the most-skipped section.** A missing or empty out-of-scope list is the highest-priority finding — every team has out-of-scope; an empty list means it wasn't considered.
- **Exit-criteria vagueness** is the next highest. `"Quality is acceptable"` becomes a vibes-based certification later.
- **Risk-table flattening** (everything High, or everything Medium) means the strategy isn't actually prioritized.
- **Inconsistent severity / priority taxonomy across sibling units** propagates into every downstream stage — flag it here, where it's cheap to fix.
