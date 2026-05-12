# Plan Stage — Execution

## Per-unit baton (`planner → estimator → verifier`)

Every plan unit walks the three hats in order. The baton across the rally race is the unit's own outputs accumulating in `PROJECT-PLAN.md`:

1. **`planner` (plan):** Reads the charter, focusing on in-scope items, success criteria, constraints, and the stakeholder map. Writes the work breakdown structure (every charter in-scope item decomposed into work packages of 8-40 hours with named done conditions and single-owner-accountable assignments), the dependency graph (predecessors / successors / external dependencies with source-and-fallback), and the sequenced schedule with the critical path marked explicitly. Hands off when every charter in-scope item is represented, no item crosses an out-of-scope boundary, owners have confirmed capacity, and the critical path is identified.
2. **`estimator` (do):** Reads the planner's WBS and dependency graph. Attaches most-likely effort, range, confidence level, method (historical / analogous / three-point / parametric / expert judgment), and assumptions to every work package. Applies contingency at the work-package level (for low-confidence items) and at the schedule level (project reserve). Flags high-uncertainty items (range > 3× most-likely) for proposed risk reduction. Hands off when every work package has a documented estimate with method, contingency is named separately from estimates, and consumption authority is recorded.
3. **`verifier` (verify):** Reads the unit's full body. Checks substance, trace-to-charter, internal coherence, decision-register accountability per the verifier mandate. Either advances (body passes) or rejects with the failing criterion named (rewinds to the responsible hat within the current unit).

The hat order is `plan → do → verify` because the WBS and dependencies frame what gets estimated. Estimating before the decomposition is stable produces numbers that have to be redone every time the structure changes.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's `completeness` review agent and any studio-level review agents fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The `fix_hats: [classifier, planner, feedback-assessor]` chain dispatches per finding. Classifier routes the FB; `planner` re-authors the affected WBS, dependency, or estimate; the assessor independently decides closure.
4. **Gate** — The gate is `ask` — local approval of the plan baseline is sufficient for most teams. Project overlays can flip to `external` (formal plan-baseline sign-off in a portfolio tool) where governance requires it.

## Reviewer guidance specific to this stage

- **Charter in-scope items missing from the WBS** is the highest-priority finding — work that was promised at chartering but never appears in the plan won't get done.
- **Single-point estimates without confidence range** are the next priority. They communicate certainty the estimator doesn't have and make rational contingency-reserve sizing impossible.
- **Hidden padding inside estimates** is corrosive — once teams learn estimates have invisible buffers, they stop trusting any of the numbers. Surface contingency separately, always.
- **External dependencies treated as if controlled by the project** are a common blind spot — without source, fallback, and escalation trigger, they're the most likely cause of unexplained slip downstream.
