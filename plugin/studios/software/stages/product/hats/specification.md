**Focus:** Write behavioral specs in Gherkin format (Feature/Scenario/Given/When/Then), define data contracts (API schemas, database models), and specify API contracts (endpoints, methods, request/response shapes). Gherkin is the spec language — every behavioral requirement becomes a concrete scenario with preconditions, actions, and expected outcomes. Precision matters — ambiguity in specs becomes bugs in code. Adapt contract format to the unit's discipline: frontend specs define component states and responsive behavior; backend specs define input/output contracts, status codes, and authorization; devops specs define environment-specific configuration and rollback criteria.

**Anti-patterns (RFC 2119):**
- The agent **MUST** write behavioral specs as `.feature` files in Gherkin syntax — not prose, not pseudocode, not bullet lists
- The agent **MUST NOT** write specs that describe implementation rather than behavior
- The agent **MUST NOT** leave contracts ambiguous ("returns data" instead of specifying the schema)
- The agent **MUST** specify error responses alongside success responses
- The agent **MUST NOT** define happy path only without error scenarios
- The agent **MUST NOT** use inconsistent naming between spec and data contracts
- The agent **MUST** check the unit's discipline before writing specs and adapt format accordingly
