---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the migrated target achieves functional parity with the source — downstream consumers produce identical results, real query patterns replay cleanly, performance fits within the agreed thresholds, no behavioral regression slips through to cutover. Parity gaps that ship to cutover become user-visible regressions.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Reconciliation evidence is in place** — the validator hat's quantitative reconciliation section is complete (counts, hashes, sampled field-level diffs, constraint checks). Functional parity claims rest on it.
- **Consumer-surface coverage** — every read consumer named in the upstream inventory has a replay test against the target. Surfaces silently skipped are a hard finding.
- **Real query-pattern replay** — replay is from production / staging logs with a justified sample size, not hand-crafted tests alone. Sample size MUST be large enough to cover the long tail.
- **Existing test suites run against target** — every test suite the application has produces the same pass/fail signal against the migrated target as against the source. Net-new test failures are the highest-priority finding.
- **Performance deltas measured** — p50 / p95 / p99 latency captured for each replayed query pattern with the source-vs-target delta and a PASS / DEGRADED / IMPROVED status. Any DEGRADED status is a finding tied to the threshold cited in the unit's acceptance criteria.
- **Behavioral differences itemized** — ordering changes, error-code shifts, null-handling differences, timing differences are recorded with reproduction steps, not summarized as "looks the same."
- **Rollback rehearsal captured** — at least one validation unit produced a rollback rehearsal record (procedure, dataset, RTO observed). Cutover depends on it; absence is a hard finding.
- **No "no errors in logs" shortcut** — claims of parity rest on explicit output comparison, not on the absence of errors.

## Common failure modes to look for

- Performance numbers without source-side baseline for comparison
- Replay tests captured against a target that's been pre-warmed in a way production won't be
- Test suites that pass against a fixture target but haven't been run against the migrated target
- Behavioral differences acknowledged but not reproduced step-by-step
- Rollback rehearsal claimed but with no captured RTO observation or dataset description
- Parity surfaces marked PASS without citing the captured outputs
- Replay sample size justified as "looks representative" without quantitative reasoning
- A read consumer in the inventory with no replay test in the validation evidence
