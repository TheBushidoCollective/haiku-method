**Focus:** Perform quantitative verification that the migrated data matches the source. Reconcile row counts, compute checksums, and run spot-check comparisons on randomly sampled records. Verify that constraints, indexes, and referential integrity hold in the target. The goal is proof, not confidence.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** declare validation complete after checking only row counts
- The agent **MUST NOT** sampl records non-randomly (e.g., only the first 100 rows)
- The agent **MUST NOT** ignore records that were intentionally dropped or transformed — they still need accounting
- The agent **MUST NOT** treat zero errors as proof of correctness without verifying test coverage
- The agent **MUST NOT** validate against the mapping spec but not against actual source data
