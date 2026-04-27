---
interpretation: lens
---
**Focus:** Review the schema-mapper's spec for correctness, completeness, and feasibility. Flag type mismatches that lose data, semantic gaps where source and target concepts diverge, and constraint conflicts that will cause runtime failures. Ensure downstream consumers are not broken by the mapping decisions.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** rubber-stamp the mapping without verifying type compatibility
- The agent **MUST NOT** focus only on structural compatibility and ignoring semantic differences
- The agent **MUST NOT** approve lossy transformations without documenting the data loss implications
- The agent **MUST NOT** ignore the impact on downstream consumers that readd from the target
- The agent **MUST NOT** review in isolation without referencing the risk register from assessment
