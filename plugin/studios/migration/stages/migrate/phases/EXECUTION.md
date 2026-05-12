# Migrate Stage — Execution

## Per-unit baton (`migration-engineer → integration-tester → verifier`)

Every migrate unit walks three hats in `plan → do → verify` order:

1. **`migration-engineer` (plan / do for migration code):** Reads the mapping spec for this entity / surface and implements the migration logic — extract, transform, load, error handling, idempotency, dry-run support, checkpointing. Picks the migration shape (bulk / incremental / dual-write / CDC) appropriate to the unit's volume and downtime budget. Hands off when every mapping-spec row is implemented and the script's mandatory properties (idempotency, dry-run, checkpointing, parameterization, loud error handling, bounded transaction scope) are in place.
2. **`integration-tester` (do for test evidence):** Runs the script against a representative non-production target with a test dataset that exercises every mapping rule, every edge case, and at least one failure-injection per recovery path. Proves idempotency by running twice. Compares dry-run output to live-run output. Hands off when the `## Integration test results` section is complete with every transform exercised and every recovery path tested.
3. **`verifier` (verify):** Validates that every acceptance criterion is paired with a concrete verify-command, runs the named commands, confirms substantive spec match. Advances on pass; rejects to the responsible hat on fail with a specific failed criterion named.

The baton: code references mapping-spec rows; tests reference code behaviors; the verifier reads both and decides.

## After execute completes

When every migrate unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. Confirms the implementation conforms to the mapping spec.
2. **Quality review (parallel)** — `data-integrity` and any studio-level review agents fire in parallel.
3. **Fix loop (if any feedback opens)** — `fix_hats:` chain (`classifier → migration-engineer → feedback-assessor`) dispatches per finding. The classifier routes; `migration-engineer` re-authors the affected script or test; `feedback-assessor` closes.
4. **Gate** — The stage's gate is `ask` — local approval once the integration tests pass and `data-integrity` signs off.

## Reviewer guidance specific to this stage

- **Idempotency claims without a second-run experiment** are the single highest-priority finding. Without the second run, idempotency is an assumption, and an assumption that fails turns the next migration retry into a corruption event.
- **Failure injection coverage gaps** (a recovery path with no failure-injection test) leave the script unproven under the conditions that matter most.
- **Dry-run / live-run drift** is a hard reject — dry-run is the artifact reviewers depend on before cutover.
- **Hardcoded connection strings or credentials** in scripts or tests are an immediate finding regardless of how clean the rest of the code is.
- **Mapping-spec rows without exercising tests** are coverage gaps; every row needs at least one test row.
