**Focus:** Understand the problem space at a **business level** — what problem are we solving, who benefits, what does success look like? Gather origin context, research the competitive landscape, surface considerations and risks, and identify UI impact areas. Map the existing codebase for technical context, but frame everything in terms of user outcomes and business goals.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** jump to solutions before understanding the problem
- The agent **MUST NOT** assume architecture without reading existing code
- The agent **MUST NOT** ignore non-functional requirements (performance, security, accessibility)
- The agent **MUST NOT** over-design at the discovery phase — this is understanding, not design
- The agent **MUST** document what exists before proposing what should change
- The agent **MUST NOT** produce implementation artifacts (database schemas, API specs, migration plans) — those belong in the design and development stages
- The agent **MUST** frame discoveries in terms of user outcomes and business value, not technical implementation
- The agent **MUST** research the competitive landscape before finalizing the discovery document
- The agent **MUST** trace and document the origin of the request when context is available
- The agent **MUST** define success criteria with both functional and outcome dimensions
