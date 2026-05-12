**Focus:** Implement extraction logic that reliably moves data from sources to the staging area. Handle incremental loads, rate limiting, error recovery, and extraction-metadata tracking. Correctness and idempotency over speed — a fast extractor that drops records on transient errors is broken, no matter how fast.

## Process

### 1. Read your inputs

- Discovery's `SOURCE-CATALOG.md` — the integration pattern, watermark column, and reliability tier per source are already chosen there. Don't re-decide them
- The schema-analyst's profile — every type quirk, null sentinel, and encoding caveat needs handling here
- Sibling units' extraction code — naming conventions, secrets-management patterns, and staging-layout choices must stay consistent across the pipeline

### 2. Implement the extraction pattern

Match the implementation to the pattern recorded in discovery:

- **Full snapshot** — read the source, write the staging table, commit atomically (write to a side location and swap, or write with a load-ID partition column). Never truncate-and-load in the path consumers read
- **Incremental with watermark** — read the high-water mark from the staging metadata, query the source for rows with watermark > high-water mark, write to staging, advance the high-water mark only after a successful commit. The advance is a side effect of success, not a precondition
- **CDC** — subscribe to the source's change feed, apply changes idempotently to the staging area. Idempotency is non-negotiable — CDC feeds replay
- **Event subscription** — consume with explicit offset management; commit offsets only after the staging write succeeds

### 3. Handle rate limits and source load

- Read the rate limit / quota the discovery brief recorded; size your concurrency below it with headroom
- Implement retry with exponential backoff and a maximum attempt count; on max-attempt failure, dead-letter the affected batch rather than dropping it or stalling the pipeline
- Use connection pooling consistent with the source's documented limits — a connector that opens 200 connections to a source that allows 50 will get throttled at the wrong layer

### 4. Make every run idempotent

A connector that produces different results when re-run is a connector that will produce different results when an operator reruns it during an incident:

- **Watermark-based extractors** — re-running for the same window MUST produce the same staged rows, even if the source data has been deleted or updated since (record source-snapshot timestamps)
- **CDC consumers** — replays MUST converge to the same target state; use the change feed's sequence numbers as natural idempotency keys
- **Event consumers** — use the event ID as the staging-side idempotency key, not the message-bus offset (offsets are not stable across topic rebalances)

### 5. Track extraction metadata

Every extraction run writes metadata that operators will need at 3 AM:

- Run ID, start / end timestamps, duration
- Source watermark range read (from / to)
- Row counts: read, written, skipped (per skip reason), dead-lettered
- Error counts and last error message
- Schema fingerprint if the source has implicit schema (so schema-drift alerts can fire)

Surface this metadata via a queryable staging-area table, not just log lines. Operators don't have time to grep historical logs during an incident.

### 6. Detect schema drift

Sources change. The extractor must notice when:

- A new column appeared (decide: pass through, ignore, or alert)
- An existing column changed type or nullability (alert; the transformation stage's assumptions are no longer valid)
- An expected column is gone (alert; the pipeline is now extracting a different thing than what discovery profiled)

Silent column drops are the defect class that hides best — never silently truncate.

## Format guidance

Extractors are code, not prose, but the unit body should record decisions:

```
## Source and pattern
- system, watermark column, expected cadence

## Idempotency strategy
- key, dedup mechanism, replay behavior

## Failure handling
- retry policy, dead-letter destination, alerting hooks

## Drift handling
- new column policy, type-change policy, missing-column policy

## Metadata captured
- list of fields written to the run metadata table
```

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** build only full-load extraction when incremental is feasible — read the discovery brief and match its choice
- The agent **MUST NOT** ignore source system rate limits or connection-pool constraints
- The agent **MUST NOT** silently drop records on extraction errors — dead-letter instead
- The agent **MUST** track extraction metadata (when, what, how much, why) in a queryable form, not just log lines
- The agent **MUST NOT** hardcode connection strings or credentials — use the project's secrets-management convention
- The agent **MUST** make every run idempotent — re-runs MUST converge to the same staged state
- The agent **MUST NOT** silently truncate or drop columns when source schema drifts — alert and let an operator decide
- The agent **MUST** advance watermarks only after a successful commit, not before
