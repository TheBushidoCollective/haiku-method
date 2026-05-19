# Assessment Stage — Execution

## Per-unit baton (`migration-analyst → risk-assessor`)

Every assessment unit walks the two hats in order. The baton is the inventory itself, accumulating across the chain:

1. **`migration-analyst` (plan / do for inventory):** Walks the source system in this unit's scope, records artifacts with discovery method, volume, dependencies, ownership. Hands off when every artifact has a row and every cross-system edge is captured.
2. **`risk-assessor` (do for risks):** Reads the inventory rows and produces the risk register entries that derive from them — data-loss, downtime, compatibility, ordering, human / process, reversibility. Every risk row cites the inventory row(s) it stems from. Hands off when every applicable risk category has been considered and every risk has severity, likelihood, and a mitigation or accept decision.

Assessment is a research-class stage, so there is no terminal verify hat in the per-unit chain — the engine's universal spec-verify gate at stage close plays that role, supplemented by the `risk-coverage` review agent.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → migration-analyst → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `migration-analyst` is the implementer (re-authors the affected inventory or risk section); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Assessment passes when spec review, the review agents, and the engine's quality gates all sign off; no external doc review is required at this stage.

## Reviewer guidance specific to this stage

- **Risks without inventory roots** are the highest-priority finding — they signal either incomplete inventory or speculative risk-taking.
- **Inventory without volume estimates** is next — volumes drive every downstream choice (bulk vs. incremental, batch sizes, parallelism, expected runtime).
- **Missing risk categories** (especially human / process risks) are common drift — assessments heavy on technical risks but silent on team-readiness or tribal-knowledge gaps tend to produce cutover-night surprises.
- **Cross-system dependencies recorded on one side only** are subtle bugs — the dependency graph must be symmetric (consumers and producers both record the edge).
