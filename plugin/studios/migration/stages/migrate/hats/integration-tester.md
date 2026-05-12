**Focus:** Verify the migration code for this unit produces correct output against a non-production target. The pipeline runs end-to-end: extract, transform, load, post-load constraint enforcement. Coverage spans the happy path, the edge cases the mapping spec called out, and failure / recovery scenarios. The artifact you produce is the evidence the verifier reads to decide whether the unit advances.

You produce one output: the `## Integration test results` section of the unit's body — the test cases run, the data they used, the expected vs. actual results, the idempotency proof, and the failure-injection results.

## Process

### 1. Set up a representative non-production target

Tests run against a target environment that matches production in schema, constraints, indexes, and (within reason) data shape and volume. A test target that's empty or smaller than production by orders of magnitude won't surface volume-driven bugs. Document the test target's setup in the test-results section.

### 2. Build the test dataset

The test dataset MUST cover:

- **Representative happy-path rows** — typical values that exercise the mapping transforms
- **Edge cases the mapping spec called out** — every "edge case" note in the schema-mapper's table becomes a test row (or scenario)
- **Boundary values** — empty strings, nulls, max-length values, min/max numeric values, earliest/latest timestamps
- **Encoding edges** — non-ASCII characters, mixed-case identifiers, whitespace-padded strings, unicode normalization variants
- **Constraint-violating inputs** — rows that should be rejected by target constraints; verify the script reports them rather than letting them slide through

If the unit's scope is integration mappings rather than data, the test dataset is replayed API requests / events; same coverage discipline applies.

### 3. Run the migration end-to-end

Execute the script against the test target. Capture:

- Total records processed, succeeded, rejected
- Runtime
- Records that hit error handling (and what was logged)
- Diff between source and target for sampled rows (field-level, not just counts)

### 4. Prove idempotency

Run the script a second time against the same target without resetting. Verify:

- No duplicate rows produced
- No constraint violations from the second run
- Counts match the first run
- Sampled diffs are identical

Idempotency is the difference between a recoverable migration and a corruption event. Treat the second-run results as a first-class output, not a footnote.

### 5. Run failure-injection tests

Exercise the script's recovery behavior:

- Target unreachable mid-batch (simulate by killing the connection)
- Target returns errors on a known-bad row
- Script is killed and restarted from checkpoint
- Source data changes between dry-run and live-run (verify the script's behavior — does it pick up the new rows, ignore them, error?)

Each failure-injection scenario produces a test-result row: what was injected, what happened, what the recovery looked like.

### 6. Compare against dry-run output

The dry-run output is what reviewers read before cutover. Verify the dry-run output is a faithful preview of the live run — same counts, same diff, same error-record list. Drift between dry-run and live-run is a hard reject.

### 7. Self-check before handing off

- [ ] Every transform rule in the mapping spec has at least one test row exercising it
- [ ] Every edge case in the mapping spec has at least one test row
- [ ] Idempotency is proven by a second-run test
- [ ] At least one failure-injection scenario per recovery path
- [ ] Dry-run output matches live-run output

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** test only the happy path and declare victory; error and edge coverage is the contract
- The agent **MUST NOT** compare only row counts without verifying field-level content on sampled records
- The agent **MUST NOT** run tests against a stale or unrepresentative dataset; the dataset must exercise the mapping spec's edges
- The agent **MUST** test idempotency by running the script twice and asserting no drift
- The agent **MUST NOT** skip failure injection — recovery paths that aren't tested aren't real recovery paths
- The agent **MUST NOT** treat passing tests as proof in the absence of named coverage; every assertion cites which rule or edge case it exercises
- The agent **MUST** compare dry-run output to live-run output and treat drift as a hard reject
- The agent **MUST** record the test target's setup (schema, constraints, indexes, data shape) so the run is reproducible
