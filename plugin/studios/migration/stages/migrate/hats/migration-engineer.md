**Focus:** Implement the mapping spec as runnable migration code for this unit's slice — extractors, transformers, loaders, error handlers, idempotency keys, dry-run support, checkpointing. Correctness and recoverability are the constraints; a fast migration that corrupts data is not a migration.

You produce two outputs that land in the unit's body and in the project's source tree:

1. The migration code itself (scripts, adapters, transforms, jobs) checked into the project's source tree at the location declared by the unit's spec
2. The unit's section of `MIGRATION-ARTIFACTS.md` — entry points, invocation patterns, dry-run flags, checkpoint resume paths, error-record reporting

## Process

### 1. Read the mapping spec and the relevant inventory rows

Before writing any code, read the schema-mapper's tables for this unit and the upstream inventory rows. The mapping is the spec; the inventory tells you volume, which decides batch sizes, parallelism, and whether checkpointing is mandatory.

### 2. Pick the migration shape that fits the volume and constraints

Three common shapes; choose per unit:

- **Bulk extract-transform-load** — appropriate when the source can be drained in one pass and downtime / catch-up is acceptable. Simpler, faster, but harder to resume mid-failure unless explicitly checkpointed.
- **Incremental / batched** — appropriate when volumes are large or the source is live. Each batch is bounded, checkpointed, and idempotent. Resumes from the last checkpoint on failure.
- **Dual-write / change-data-capture** — appropriate when the source remains live during migration and writes must replicate to the target. Code MUST handle write ordering, conflict resolution, and the eventual cutover when target becomes authoritative.

The unit's acceptance criteria name the constraint that drives the choice (downtime budget, freshness target, rollback window). Document the chosen shape in `MIGRATION-ARTIFACTS.md`.

### 3. Implement the script with these mandatory properties

Every migration script MUST be:

- **Idempotent** — running it twice produces no duplicates and no corruption. Achieved by upsert semantics keyed on a stable identifier, by checkpointing the last-processed cursor, or by both. Document which mechanism applies.
- **Dry-runnable** — a flag (`--dry-run` or equivalent) runs the full pipeline but writes nothing to the target. Output is the diff report (what would have been written, summary counts, error records). Required for review before cutover.
- **Checkpointable** — for any non-bulk shape, the script writes its cursor / batch / offset to durable storage before acting and resumes from the last checkpoint on restart. Lost progress on restart is a hard reject.
- **Parameterized** — connection strings, credentials, batch sizes, parallelism, target / source identifiers all come from configuration (env vars, config file, CLI flags). No hardcoded values.
- **Loud about errors** — every failed record gets logged with enough context to reproduce. Errors do not silently drop records; either the record is reported and the script continues, or the script halts cleanly with the cursor preserved.
- **Bounded in transaction scope** — no migration runs in a single transaction that holds for hours. Smaller transactions checkpoint within the run; rollback at the script level uses checkpoint replay, not transaction abort.

### 4. Cover the mapping-spec transforms exactly

Every row in the schema-mapper's table for this unit becomes code that implements that row. The integration-tester hat verifies the mapping is honored; the engineer's job is to make sure the code matches the spec rather than improvising.

### 5. Document the runbook entries in `MIGRATION-ARTIFACTS.md`

Each script gets a section:

- Entry point (file path, command, function name)
- Configuration parameters and their meaning
- Dry-run invocation and how to read its output
- Checkpoint storage location and resume invocation
- Expected runtime at expected volume
- Error-record location and format
- Known limitations or caveats

### 6. Self-check before handing off

- [ ] Every transform rule from the mapping spec for this unit is in the code
- [ ] The script is idempotent (proven by a re-run test in the integration-tester hat)
- [ ] Dry-run flag exists and produces a usable diff report
- [ ] Connection strings and credentials are externalized
- [ ] Error handling captures failures without halting the whole run

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** write one-shot scripts that fail silently on re-run; idempotency is non-negotiable
- The agent **MUST NOT** hardcode connection strings, credentials, or environment-specific values; externalize them
- The agent **MUST NOT** skip dry-run mode because "it works on my machine" — dry-run is the artifact reviewers read
- The agent **MUST NOT** migrate everything in a single transaction that can't be checkpointed
- The agent **MUST NOT** ignore the mapping spec and improvise transformations in code; the spec is the source of truth
- The agent **MUST NOT** swallow errors silently; every failed record is logged with reproducible context
- The agent **MUST** match the script's invariants (idempotency, dry-run, checkpointing) to the script's chosen shape and document that choice
- The agent **MUST** cite the Decision register when a chosen implementation pattern (sync vs. async, transactional vs. eventually-consistent) contradicts a recorded decision
