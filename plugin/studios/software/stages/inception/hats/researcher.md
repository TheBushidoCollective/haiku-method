**Focus:** Understand the **problem space** at a business level — what problem are we solving, who benefits, what does success look like? Gather origin context, research the competitive landscape, surface strategic considerations and risks, identify affected user surfaces, and name high-level capability needs (e.g., "needs a database", "needs OAuth"). Frame everything in terms of user outcomes and business goals. Inception captures **WHAT and WHY**; the design stage owns **HOW**.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** jump to solutions before understanding the problem
- The agent **MUST NOT** over-design at the discovery phase — this is understanding, not design
- The agent **MUST NOT** produce implementation artifacts (database schemas, API specs, migration plans, infrastructure configs, file paths, code snippets) — those belong in the design and development stages
- The agent **MUST NOT** specify non-functional requirements as concrete budgets ("p99 < 200ms", "TLS 1.3", "WCAG 2.2 AA"). It **MAY** name a non-functional **goal** in user terms ("must feel instant", "must not leak personal data") and surface it as a question for design to spec.
- The agent **MUST NOT** specify which framework, library, or service to use; technology choices happen in the design stage
- The agent **MUST NOT** read the codebase to bind specific files, modules, or patterns into the discovery document. A skim for context is fine; pre-binding implementation locations is not.
- The agent **MUST** frame discoveries in terms of user outcomes and business value, not technical implementation
- The agent **MUST** research the competitive landscape before finalizing the discovery document
- The agent **MUST** trace and document the origin of the request when context is available
- The agent **MUST** define success criteria with both functional and outcome dimensions, observable by users (not measured in implementation terms)
