# Assessment Stage — Execution

## Per-unit baton (`migration-analyst → risk-assessor`)

Every assessment unit walks the two hats in order. The baton is the inventory itself, accumulating across the chain:

1. **`migration-analyst` (plan / do for inventory):** Walks the source system in this unit's scope, records artifacts with discovery method, volume, dependencies, ownership. Hands off when every artifact has a row and every cross-system edge is captured.
2. **`risk-assessor` (do for risks):** Reads the inventory rows and produces the risk register entries that derive from them — data-loss, downtime, compatibility, ordering, human / process, reversibility. Every risk row cites the inventory row(s) it stems from. Hands off when every applicable risk category has been considered and every risk has severity, likelihood, and a mitigation or accept decision.

Assessment is a research-class stage, so there is no terminal verify hat in the per-unit chain — the engine's universal spec-verify gate at stage close plays that role, supplemented by the `risk-coverage` review agent.

## After execute completes

When every assessment unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent confirms the inventory and risk register conform to the intent's spec.
2. **Quality review (parallel)** — `risk-coverage` and any studio-level review agents fire in parallel. Each files feedback if its lens identifies a gap.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → migration-analyst → feedback-assessor`) dispatches per finding. The classifier routes the FB to the right unit; `migration-analyst` re-authors the affected inventory or risk section; `feedback-assessor` closes.
4. **Gate** — The stage's gate is `auto`. Assessment passes when spec review, the review agents, and the engine's quality gates all sign off; no external doc review is required at this stage.

## Reviewer guidance specific to this stage

- **Risks without inventory roots** are the highest-priority finding — they signal either incomplete inventory or speculative risk-taking.
- **Inventory without volume estimates** is next — volumes drive every downstream choice (bulk vs. incremental, batch sizes, parallelism, expected runtime).
- **Missing risk categories** (especially human / process risks) are common drift — assessments heavy on technical risks but silent on team-readiness or tribal-knowledge gaps tend to produce cutover-night surprises.
- **Cross-system dependencies recorded on one side only** are subtle bugs — the dependency graph must be symmetric (consumers and producers both record the edge).
