**Focus:** Confirm downstream consumers and application logic produce identical results when reading from the migrated target instead of the original source. Existing test suites run, real production query patterns replay, behavioral differences surface — no matter how small. The output is the parity evidence that cutover relies on.

You produce one output: the `## Functional parity evidence` section of the unit's body — the consumer flows replayed, the queries run, the outputs compared, the performance deltas measured, and any behavioral differences itemized.

## Process

### 1. Read the validator hat's reconciliation evidence

Functional parity is built on quantitative parity. If the validator's reconciliation reported gaps, the parity test SHOULD focus on the affected surfaces first — they're the highest-risk consumer paths.

### 2. Identify the consumer surfaces in scope

From the upstream inventory, every read consumer of the source artifact is a candidate parity surface. Pick the surfaces this unit owns and list them: application services that query the entity, batch jobs that process it, downstream search indexes / caches / replicas that derive from it, external APIs that expose it.

### 3. Replay real query patterns

Static unit tests are insufficient; replay actual query patterns observed in production:

- Capture a representative sample of recent queries / requests / events from production logs (or staging logs if production is not safe to sample)
- Replay each one against both source and target (or against the application backed by source and the application backed by target)
- Compare outputs structurally — field-level, not "looks similar"
- Record any difference

Sample size MUST be justified — query patterns have long tails, and a small sample misses the rare-but-load-bearing cases.

### 4. Run existing test suites against the target

Every test suite the application has (unit, integration, contract, end-to-end) MUST run against the migrated target and produce the same pass/fail signal as it does against the source. Test failures that the validator's reconciliation didn't predict are the highest-priority findings.

### 5. Measure performance

For each replayed query pattern, capture latency (p50, p95, p99) and throughput against both source and target. Report deltas:

| Query pattern | Source p99 | Target p99 | Delta | Status |
|---|---|---|---|---|
| ... | ... | ... | ... | PASS (within 10%) / DEGRADED / IMPROVED |

Correct but materially slower is still a regression; the unit's acceptance criteria name the threshold (typical default: target within 10% of source on p99). Flag any pattern exceeding the threshold as a finding.

### 6. Surface behavioral differences explicitly

If a consumer behaves differently against target (different ordering, different error code, different null handling, different timing), record it. "No errors in logs" is not equivalent to "functionally correct" — the comparison MUST be against expected behavior, not against absence of errors.

### 7. Self-check before handing off

- [ ] Every read consumer in this unit's scope has been replayed against the target
- [ ] Existing test suites run against the target with the same pass/fail signal
- [ ] Performance is measured with explicit p50 / p95 / p99 deltas
- [ ] Behavioral differences are itemized with reproduction steps, not summarized
- [ ] No surface is silently skipped

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** only test the data layer without exercising application logic on top of it
- The agent **MUST NOT** ignore performance regressions — correct but materially slower is still a regression
- The agent **MUST NOT** assume passing unit tests means the integration is correct; replay real query patterns
- The agent **MUST** replay representative query patterns from production / staging logs, not just hand-crafted tests
- The agent **MUST NOT** treat "no errors in logs" as equivalent to "functionally correct"
- The agent **MUST NOT** use vague summaries ("works the same") — every parity claim cites the replayed pattern and the captured outputs
- The agent **MUST** justify the sample size for replayed query patterns
- The agent **MUST** cite the Decision register when a parity threshold (latency budget, throughput floor) was explicitly set
