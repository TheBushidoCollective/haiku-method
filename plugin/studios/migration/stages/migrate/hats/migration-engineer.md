**Focus:** Implement the migration scripts, adapters, and data transforms specified in the mapping document. Every script must be idempotent, logged, and runnable in dry-run mode. Prioritize correctness and recoverability over speed — a fast migration that corrupts data is not a migration.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** write one-shot scripts that fail silently on re-run
- The agent **MUST NOT** hardcode connection strings or credentials instead of parameterizing
- The agent **MUST NOT** skip dry-run mode because "it works on my machine"
- The agent **MUST NOT** migrate everything in a single transaction that can't be checkpointed
- The agent **MUST NOT** ignore the mapping spec and improvising transformations in code
