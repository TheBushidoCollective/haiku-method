**Focus:** Perform quantitative reconciliation between source and target for this unit's verification surface. Row counts, hash digests, sampled field-level diffs, constraint and referential-integrity checks. Confidence is not the goal — proof is. The output gates cutover, so weak evidence here means cutover ships with weak ground.

You produce one output: the `## Reconciliation evidence` section of the unit's body — the methods used, the queries run, the counts and hashes captured, the sampled diffs, and the constraint-check results.

## Process

### 1. Name the verification surface precisely

The unit's surface is one of:

- An entity / table comparison (every row in source has a corresponding row in target, transformed per the mapping spec)
- A constraint / referential-integrity check (target enforces what the mapping spec said it would enforce)
- A relationship integrity check (foreign-key cardinality holds; orphan / dangling refs are absent)
- An invariant that crosses entities (totals reconcile, derived aggregates match)

Write the surface in plain language at the top of the section. Vague surfaces ("data looks right") cannot be reconciled.

### 2. Reconcile counts

Run the count comparison: source rows of category X versus target rows after migration, accounting for any rows the mapping spec dropped or merged. Output:

| Metric | Source value | Target value | Expected delta | Actual delta | Status |
|---|---|---|---|---|---|
| Total rows | N | M | per mapping spec | M − N − dropped | PASS / FAIL |
| Rows per partition | ... | ... | ... | ... | ... |

A non-zero unexpected delta is a hard FAIL; the rationale for any expected delta MUST cite the mapping-spec row that produced it.

### 3. Reconcile content via hashes

For each entity in scope, compute a stable hash digest over the canonical row representation (after the same normalization the mapping spec describes) and compare source vs. target. Hash equality is the strongest evidence; hash drift drives sample-based investigation.

Document the hash method (which fields, in which order, with which normalization) so a reviewer can re-run it.

### 4. Sample-based field-level diff

Take a random sample of records (sample size justified by source volume — the sample MUST be large enough to surface a statistically meaningful difference if one exists; the unit's elaboration phase MUST have pinned the sample size). For each sampled record:

- Pull source representation
- Pull target representation
- Apply the mapping-spec transforms to source
- Diff transformed-source vs. target field-by-field
- Record any diff

Sampled diffs of zero across the sample is the success signal; any non-zero diff is a finding cited to the field that differed.

### 5. Run constraint and referential checks

Verify the target enforces what the mapping spec promised:

- Unique constraints — query for duplicate keys
- Foreign keys — query for orphan rows
- Check constraints — query for rows violating the check predicate
- Not-null — query for nulls in non-null columns
- Indexes — verify presence (and selectivity if the mapping spec specified it)

### 6. Account for intentionally dropped or transformed records

Records the mapping spec said to drop or transform-away MUST be accounted for. The reconciliation table includes a row for each such category with the expected count and the rationale citing the mapping-spec row.

### 7. Self-check before handing off

- [ ] Surface is named in plain language
- [ ] Counts are reconciled with explicit expected deltas
- [ ] Hash digests are computed with a documented method
- [ ] Sample-based diff has a justified sample size and reports zero or itemizes findings
- [ ] Constraint and referential checks are run and pass / fail status is recorded
- [ ] Dropped / transformed records are accounted for, not ignored

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** declare validation complete after checking only row counts; counts without content are weak evidence
- The agent **MUST NOT** sample records non-randomly (the first N rows is not a random sample)
- The agent **MUST NOT** ignore records that were intentionally dropped or transformed — they still need accounting
- The agent **MUST NOT** treat "zero errors in the run" as proof of correctness without verifying coverage
- The agent **MUST NOT** validate against the mapping spec only and not against actual source data — both must match
- The agent **MUST NOT** use ambiguous status labels ("looks good", "probably fine") — every row is PASS or FAIL with cited evidence
- The agent **MUST** document the hash method so the reconciliation is reproducible
- The agent **MUST** cite the mapping-spec row for every expected delta
