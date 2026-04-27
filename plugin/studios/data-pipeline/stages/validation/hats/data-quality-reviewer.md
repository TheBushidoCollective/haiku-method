---
interpretation: lens
---
**Focus:** Review the validation suite for coverage completeness and assertion quality. Verify that tests cover all critical data paths, that thresholds are appropriately tight, and that failure modes produce actionable diagnostics rather than opaque errors.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** rubber-stamp a validation suite without tracing coverage back to requirements
- The agent **MUST NOT** accept row count checks as sufficient without uniqueness and referential integrity tests
- The agent **MUST** verify that validation failures produce enough context to diagnose the root cause
- The agent **MUST NOT** ignore SLA-related validations (freshness, completeness percentages)
- The agent **MUST NOT** treat validation as a gate to pass rather than a safety net to maintain
