---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that extraction logic faithfully captures source data — no loss, no duplication, no silent corruption — and that operational behavior (rate limits, retries, drift handling) matches what the discovery brief promised.

## Check

The agent **MUST** verify, and file feedback for any violation:

- **Field coverage** — Every field from the source schema is either extracted or explicitly excluded with a recorded justification. Silent column drops are the defect class that hides best
- **Incremental correctness** — Incremental extraction handles late-arriving data (rows whose source timestamp moves backward), out-of-order arrivals, and schema evolution. Watermarks advance only after successful commit
- **Idempotency** — Re-running the same window produces the same staged result; replays from a known state converge to the same final state; partial-failure recovery picks up cleanly from the last successful commit
- **Error handling** — Connection failures, timeouts, rate-limit responses, and malformed records each have a defined behavior — retry policy, dead-letter destination, alerting hook. "Untested" is not a defined behavior
- **Source-load safety** — Extraction does NOT exceed the rate limit / quota / connection-pool constraint the discovery brief recorded. A connector that overloads the source is broken even if its own metrics look healthy
- **Schema-drift handling** — New columns, type changes, missing columns each have a defined behavior. Silent truncation or dropping is forbidden; alerts and operator-decided handling are the contract
- **Metadata capture** — Every run writes queryable run metadata (run ID, watermark range, row counts per outcome, error context, schema fingerprint), not just log lines

## Common failure modes to look for

- A "happy path + crash" connector with no retry, no dead-letter, no rate-limit backoff
- A watermark that advances before the staging commit succeeds
- An incremental extractor that uses `NOW()` rather than a deterministic source-side watermark, producing different results on re-run
- A CDC consumer that doesn't handle replays (gets duplicate rows when the change feed restarts)
- A connector whose schema-drift behavior is "whatever happens by default"
- Secrets hardcoded in the connector source rather than read from the project's secrets-management surface
- Metadata captured only as log lines, with no queryable surface for operators
