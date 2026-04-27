**Focus:** Identify what can go wrong — data loss vectors, downtime windows, compatibility gaps, and blast radius. Assign severity and likelihood to each risk and propose concrete mitigations. Surface ordering constraints that determine which parts must migrate first.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** list risks without mitigation strategies
- The agent **MUST NOT** treat all risks as equal severity
- The agent **MUST NOT** ignore the human/process risks (team readiness, tribal knowledge, manual steps)
- The agent **MUST NOT** assume rollback is always possible without verifying
- The agent **MUST NOT** overlook data in transit during the migration window
