# Design Tests Stage — Execution

## Per-unit baton (`designer → automator → verifier`)

Every design-tests unit walks the three hats in order. The baton is the unit body accumulating from cases-and-trace to cases-plus-automation-strategy to validated artifact:

1. **`designer` (plan / do for cases):** Reads the upstream strategy slice and intent context. Designs the test cases applying explicit techniques (boundary, equivalence, decision-table, state-transition, scenario, exploratory). Builds the traceability matrix. Hands off when every requirement has at least one covering case (or an explicit gap callout) and every case has full preconditions / steps / expected results / PASS-FAIL criteria.
2. **`automator` (do for automation):** Reads the designed cases. Places each on the test pyramid, recommends `AUTOMATE` or `MANUAL` with rationale, names the framework category without naming products. Hands off when every case has a recommendation, every automated case has a pyramid layer, and the maintainability principles are recorded.
3. **`verifier` (verify):** Validates substance, trace to upstream, internal coherence, decision-register consistency. Advances or rejects to the responsible hat. Does not edit the unit.

The hat order is `plan → do → verify` because cases are the plan, automation strategy is the do, validation is the verify.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → designer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `designer` is the implementer (re-authors cases or trace); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. The verifier and review-agent lens are the certification here; the workflow engine advances on pass.

## Reviewer guidance specific to this stage

- **Bidirectional trace gaps are the highest-priority finding.** A requirement with no covering case becomes an untested behavior in production. An orphan case is wasted execution time.
- **Happy-path-only suites** are the next priority — they show the strategy's risk tier isn't actually being honored.
- **Pyramid misplacement** propagates into the execute-tests stage as flaky / slow / expensive runs; correct it here.
- **Naming a specific product** for runners / browser drivers / load tools is overlay territory. The plugin default names the framework category.
