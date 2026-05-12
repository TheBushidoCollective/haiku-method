**Focus:** Build and run data quality checks that verify schema compliance, referential integrity, uniqueness, accepted value ranges, row-count reconciliation, and business-rule correctness. Every assertion is specific, automated, and produces a clear pass / fail / warning result. The validation suite is the production safety net — what passes here ships, what fails here doesn't.

## Process

### 1. Read the inputs

- Transformation's `DATA-MODEL.md` — every entity, grain, primary key, SCD type, and column type is a thing you can write tests for
- Extraction's `EXTRACTION-JOBS.md` — source-to-staging contracts that the validation suite can reconcile against
- The user's stated SLAs — freshness, completeness, accuracy. Each SLA needs at least one running check

### 2. Cover the four assertion families

Per target entity, write checks across all four:

- **Schema compliance** — types match the model spec, nullability constraints hold, columns the model declares are present
- **Uniqueness and integrity** — primary keys are unique, foreign keys resolve to existing rows, no orphan references
- **Value-range checks** — enums hold their declared values only, numerics fall in expected ranges, timestamps fall in expected windows (no `1970-01-01` or `9999-12-31` sentinels surviving into target)
- **Business-rule checks** — every business rule centralized in the transformation stage has a corresponding test (revenue-recognition math, status-mapping correctness, derived-column consistency)

A suite that covers schema but skips business rules will pass while the data is silently wrong.

### 3. Reconcile against the source

Row-count reconciliation between source and target is non-negotiable for any pipeline whose contract is "we represent the source faithfully":

- **Row counts** — source rows that match the extraction predicate count vs. target rows; tolerance stated explicitly
- **Key totals** — for monetary or aggregate domains, sum / count of key measures source-side vs. target-side
- **Per-partition reconciliation** — when the source and target are partitioned by the same dimension (date, region), reconcile per partition; aggregate reconciliation hides partition-level drift

State the tolerance per check explicitly. "Within 0.1%" is a tolerance; "approximately equal" is not.

### 4. Distinguish blocking from non-blocking

Every assertion declares its severity:

- **Blocking** — a failure stops the pipeline or blocks deployment. Reserve for correctness-critical checks (primary key uniqueness, schema compliance, row-count reconciliation beyond tolerance)
- **Warning** — a failure raises an alert but lets the pipeline continue. Right for slow-moving quality issues (rising null rate, slight cardinality drift)
- **Informational** — recorded but doesn't alert. Right for trend monitoring over time

A suite where every check is "blocking" will block the pipeline for noise; a suite where everything is "warning" provides no safety net. Mix deliberately.

### 5. Cover the freshness SLA

Per target table with a freshness SLA, write a check that:

- Reads the most recent watermark / max-timestamp in the target
- Compares against the current time (or the expected run time)
- Fails if the lag exceeds the SLA

A pipeline that's run-failing silently looks healthy until consumers notice the data hasn't moved. Freshness checks close that gap.

### 6. Diagnostic context on failure

Every assertion that fails MUST emit enough context to diagnose the cause without re-running the query manually:

- Failing rows sampled (not the full set; a representative N)
- The exact predicate that failed
- The values that triggered the failure
- Pointer to the upstream source / transformation step that produced them

An assertion that fails with just "violation in target_orders" wastes the on-call's time.

## Format guidance

Validation tests live in code. The unit body records:

```
## Target covered
- entity, model reference

## Assertions
| Check | Family | Severity | Threshold | Diagnostic on fail |

## Reconciliation
- source-to-target row counts, key totals, per-partition checks; tolerance per check

## Freshness check
- target watermark column, SLA, lag threshold

## Open coverage gaps
- explicit list of what's NOT covered and why
```

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** write only "happy path" tests without edge-case coverage
- The agent **MUST NOT** check row counts without also checking for duplicates and key collisions
- The agent **MUST NOT** validate schema structure but not actual data values
- The agent **MUST NOT** use overly loose thresholds that mask real quality issues
- The agent **MUST** distinguish blocking failures from non-blocking warnings — explicit severity per assertion
- The agent **MUST** reconcile source-to-target row counts (and key totals where applicable) with a stated tolerance
- The agent **MUST** cover freshness SLAs with a target-watermark-based check, not by trusting the pipeline's run status
- The agent **MUST** emit enough diagnostic context on assertion failure to diagnose without re-running manually
- The agent **MUST** write a business-rule check per centralized rule in the transformation stage — schema-only suites pass while data is wrong
