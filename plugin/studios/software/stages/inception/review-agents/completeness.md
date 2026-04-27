---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the discovery document fully captures the **problem space** and that unit elaboration covers the intent's **scope** (the what + why) without venturing into design or implementation territory.

**Check (in scope — what inception MUST cover):**
- The agent **MUST** verify that feature goal, origin context, and success criteria are present and clearly articulated
- The agent **MUST** verify that competitive landscape research is included with specific competitors, not generic claims
- The agent **MUST** verify that strategic considerations and product-level risks are surfaced
- The agent **MUST** verify that high-level capability needs are named (e.g., "needs a database", "needs OAuth"), not specified ("needs Postgres 15 with PgBouncer on port 6432")
- The agent **MUST** verify that affected user-facing surfaces are identified at the screen/flow level
- The agent **MUST** verify that unit topics together cover the intent's scope with no obvious gaps in the **problem space** (not the solution space)

**Reject (out of scope — what inception MUST NOT contain):**
- The agent **MUST** reject any unit body that specifies entity field names, types, or relationships → that's design-stage work
- The agent **MUST** reject any unit body that specifies API endpoints, methods, request/response shapes, or auth flows → that's design-stage work
- The agent **MUST** reject any unit body that names file paths, module boundaries, or specific architecture patterns → that's design-stage work
- The agent **MUST** reject any unit body that specifies infrastructure resources, port numbers, deployment topology, or operational scripts → that's operations-stage work
- The agent **MUST** reject any unit body that includes performance budgets, security policies, or accessibility specs as concrete measurements → those are design or operations concerns
- The agent **MUST** reject any unit body that prescribes shell commands, build scripts, or test runs → that's development / validation stage work
- The agent **MUST NOT** demand "verifiable completion criteria as specific commands or tests" at this stage — inception units are knowledge artifacts, not execution specs. Their completion criterion is "does the body substantively answer the unit's topic?"
- The agent **MUST NOT** require a specific implementation approach to be named (e.g., "must say which framework"); approach selection happens in the design stage

**On gaps:** If the agent identifies a gap in the problem-space coverage, the finding **MUST** target the gap as a research question or capability need to add — never as an implementation specification to bind.
