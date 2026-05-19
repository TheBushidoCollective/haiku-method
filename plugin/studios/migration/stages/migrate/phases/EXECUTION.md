# Migrate Stage — Execution

## Per-unit baton (`migration-engineer → integration-tester → verifier`)

Every migrate unit walks three hats in `plan → do → verify` order:

1. **`migration-engineer` (plan / do for migration code):** Reads the mapping spec for this entity / surface and implements the migration logic — extract, transform, load, error handling, idempotency, dry-run support, checkpointing. Picks the migration shape (bulk / incremental / dual-write / CDC) appropriate to the unit's volume and downtime budget. Hands off when every mapping-spec row is implemented and the script's mandatory properties (idempotency, dry-run, checkpointing, parameterization, loud error handling, bounded transaction scope) are in place.
2. **`integration-tester` (do for test evidence):** Runs the script against a representative non-production target with a test dataset that exercises every mapping rule, every edge case, and at least one failure-injection per recovery path. Proves idempotency by running twice. Compares dry-run output to live-run output. Hands off when the `## Integration test results` section is complete with every transform exercised and every recovery path tested.
3. **`verifier` (verify):** Validates that every acceptance criterion is paired with a concrete verify-command, runs the named commands, confirms substantive spec match. Advances on pass; rejects to the responsible hat on fail with a specific failed criterion named.

The baton: code references mapping-spec rows; tests reference code behaviors; the verifier reads both and decides.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → migration-engineer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `migration-engineer` is the implementer (re-authors the affected script or test); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. Local approval once the integration tests pass and `data-integrity` signs off.

## Reviewer guidance specific to this stage

- **Idempotency claims without a second-run experiment** are the single highest-priority finding. Without the second run, idempotency is an assumption, and an assumption that fails turns the next migration retry into a corruption event.
- **Failure injection coverage gaps** (a recovery path with no failure-injection test) leave the script unproven under the conditions that matter most.
- **Dry-run / live-run drift** is a hard reject — dry-run is the artifact reviewers depend on before cutover.
- **Hardcoded connection strings or credentials** in scripts or tests are an immediate finding regardless of how clean the rest of the code is.
- **Mapping-spec rows without exercising tests** are coverage gaps; every row needs at least one test row.
