# Product Stage — Execution

## Per-unit baton (`product → specification → validator`)

Every product unit walks the three hats in order. The baton across the rally race is the unit's own outputs accumulating on disk:

1. **`product` (plan / do for AC):** Reads the unit's success criteria, the inception knowledge, and the design output. Writes the unit's AC into `ACCEPTANCE-CRITERIA.md` following the variability-brief-first structure. Hands off when the AC are complete, variant-coverage is explicit, and every state-visibility list is closed.
2. **`specification` (do for spec + contracts):** Reads the AC just written. Produces one or more `.feature` files under `features/` and appends the unit's slice to `DATA-CONTRACTS.md`. Hands off when every AC item has at least one Gherkin scenario and every endpoint / table / event named in the scenarios has a contract row.
3. **`validator` (verify):** Reads every unit's success criteria, the AC, the `.feature` files, and the contracts. Builds the row-per-success-criterion matrix in `COVERAGE-MAPPING.md`. Either advances (matrix is `APPROVED`) or rejects with the responsible hat named (rewinds to that hat within the current unit).

The hat order is `plan → do → verify` because `product` produces the spec the rest of the chain implements: AC are the plan, `.feature` files + data contracts are the do, the matrix is the verify.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent reads the intent's spec and confirms the stage's artifacts conform. Always runs, no per-studio mandate.
2. **Quality review (parallel)** — The stage's review agents (`completeness`, `feasibility`) and any studio-level review agents fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → product → feedback-assessor`) dispatches against each open feedback. The classifier hat routes the FB to the right unit or stage; `product` is the implementer (re-authoring the AC where the finding belongs); the assessor independently decides closure.
4. **Gate** — The stage's gate is `[external, ask]` — the user may choose to submit the AC for external review (e.g., a Notion / Confluence doc review with engineering) or approve locally. Approval signals the stage is done and the workflow moves on to `development`.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **AC and Gherkin disagree** is the single highest-priority finding. They are the same contract in two languages — if `.feature` says one thing and `ACCEPTANCE-CRITERIA.md` says another, the developer reading them downstream will pick wrong and ship the wrong behavior.
- **Variant-coverage gaps** are next — they manifest as production bugs in the variant nobody specified.
- **Contract drift** (a `.feature` references an endpoint not in `DATA-CONTRACTS.md`, or vice versa) blocks the next stage.
- **Implementation language in scenarios** (`POST /signup ...` instead of `User submits valid form`) is a style issue but compounds into reviewer confusion across the rest of the lifecycle.
