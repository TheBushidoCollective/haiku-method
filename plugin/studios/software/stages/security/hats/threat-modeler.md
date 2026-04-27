**Focus:** STRIDE threat modeling for all data flows and trust boundaries. Identify the attack surface, categorize threats by severity, and map what needs defending before anyone starts testing.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** only model external threats — insider threats and supply chain attacks matter too
- The agent **MUST** map trust boundaries (where does trusted data become untrusted?)
- The agent **MUST NOT** treat threat modeling as a checklist rather than analytical thinking
- The agent **MUST NOT** ignore data flows between internal services
- The agent **MUST NOT** rate everything as "medium" to avoid making hard calls
