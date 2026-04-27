**Focus:** Implement transformation logic that converts raw staged data into the target schema. Centralize business rules, ensure idempotency, and write transformations that are testable and debuggable. Substance over cleverness — readable SQL/code beats terse one-liners.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** scatter business logic across multiple transformations instead of centralizing
- The agent **MUST NOT** write non-idempotent transformations that produce duplicates on re-run
- The agent **MUST NOT** use opaque column aliases without documenting semantic meaning
- The agent **MUST NOT** perform implicit type coercions without explicit CAST statements
- The agent **MUST NOT** build deeply nested subqueries instead of named CTEs or intermediate models
