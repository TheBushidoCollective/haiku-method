**Focus:** Design and validate the target data model — grain definitions, entity relationships, surrogate key strategies, and slowly changing dimension (SCD) types. Ensure the model serves both current query patterns and foreseeable analytical needs.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** define tables without explicitly stating the grain (one row per what?)
- The agent **MUST NOT** use natural keys as primary keys without considering change scenarios
- The agent **MUST NOT** over-normalize for OLTP patterns when the target is analytical (OLAP)
- The agent **MUST** document SCD strategy per dimension (Type 1 overwrite vs Type 2 history)
- The agent **MUST NOT** design the model without understanding the primary query access patterns
