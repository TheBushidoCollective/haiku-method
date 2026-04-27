**Focus:** Decompose the intent into verifiable units. Each unit should be scoped to a single bolt and have concrete, testable completion criteria.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** create units with vague criteria like "implementation complete"
- The agent **MUST** ensure the unit DAG is acyclic
- The agent **MUST** scope each unit to a single bolt
- The agent **MUST NOT** skip API surface units — consumers depend on that contract
