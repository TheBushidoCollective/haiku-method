# Plan Stage — Execution

## Per-unit baton (`strategist → planner → verifier`)

Every plan unit walks the three hats in order. The baton is the unit body accumulating from strategy to logistics to validated artifact:

1. **`strategist` (plan):** Reads product / requirements context and Decisions. Writes the unit's scope, quality-dimension map, risk-based prioritization, and entry / exit criteria. Hands off when the strategy slice is complete, measurable, and consistent with sibling units.
2. **`planner` (do):** Reads the strategy section just written. Adds resource allocation, environment requirements, test data plan, sequencing dependencies, and plan-risk mitigation. Hands off when every strategy criterion has matching logistics and the dependency graph is a DAG.
3. **`verifier` (verify):** Validates the body for substance, citation, decision-register consistency, and open-questions accounting. Advances or rejects to the responsible hat. Does not edit the unit.

The hat order is `plan → do → verify` because the strategist's scope-and-risk is the plan; the planner's logistics is the do; the verifier's validation is the verify.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → strategist → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `strategist` is the implementer (re-authors the affected strategy section); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. A human reviews the strategy locally and approves. The strategy frames every downstream stage, so the human gate is load-bearing.

## Reviewer guidance specific to this stage

When reading the stage's output:

- **Out-of-scope is the most-skipped section.** A missing or empty out-of-scope list is the highest-priority finding — every team has out-of-scope; an empty list means it wasn't considered.
- **Exit-criteria vagueness** is the next highest. `"Quality is acceptable"` becomes a vibes-based certification later.
- **Risk-table flattening** (everything High, or everything Medium) means the strategy isn't actually prioritized.
- **Inconsistent severity / priority taxonomy across sibling units** propagates into every downstream stage — flag it here, where it's cheap to fix.
