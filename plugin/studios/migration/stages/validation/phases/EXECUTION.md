# Validation Stage — Execution

## Per-unit baton (`validator → regression-tester → verifier`)

Every validation unit walks three hats in `plan → do → verify` order:

1. **`validator` (plan / do for quantitative reconciliation):** Names the verification surface, then produces reconciliation evidence — row-count reconciliation with cited expected deltas, hash digests with a documented method, sample-based field-level diff with a justified sample size, constraint and referential-integrity checks. Records intentionally-dropped or transformed records explicitly. Hands off when every surface in this unit has reconciliation evidence with a pass / fail status per row.
2. **`regression-tester` (do for functional parity):** Reads the reconciliation evidence and produces parity evidence — replayed query patterns from production / staging logs, existing test suites run against the target, performance deltas (p50 / p95 / p99) with explicit status, behavioral differences itemized with reproduction steps. Hands off when every read consumer named in the inventory has been replayed against the target.
3. **`verifier` (verify):** Validates that each verification surface names its method, threshold, evidence shape, and mechanical pass / fail criteria. Advances or rejects.

The baton: validator's quantitative evidence is the precondition for regression-tester's functional parity claims. Parity claims that can't trace to reconciled data are a sign reconciliation missed a surface.

This stage owns **rollback rehearsal**. At least one unit MUST exercise the rollback procedure end-to-end against a representative dataset and produce the rehearsal record (procedure, dataset, RTO observed). Cutover's `rollback-readiness` review agent will reject without it.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → validator → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `validator` is the implementer (re-runs or re-authors the affected reconciliation or parity test); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. Local approval once the validation report is complete and review agents have signed off. Cutover depends on it.

## Reviewer guidance specific to this stage

- **Reconciliation evidence missing for a surface that has parity claims** is the highest-priority finding. Parity without reconciliation is wishful thinking.
- **Sample sizes without justification** are a coverage gap — long-tail behavior misses get baked in.
- **Performance deltas without source baselines** can't be evaluated — flag immediately.
- **Missing rollback rehearsal record** blocks cutover at the `rollback-readiness` review; surface it now rather than letting cutover bounce back.
- **"No errors in logs"** treated as parity evidence is a classic gap — comparison must be against expected behavior, not against absence of errors.
