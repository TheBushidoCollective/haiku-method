---
interpretation: lens
---
**Focus:** Review firmware against functional requirements, safety analysis, and memory/flash budgets.

**Anti-patterns (RFC 2119):**
- The agent **MUST** verify every safety-critical code path has traceable test coverage
- The agent **MUST** verify the binary fits within memory and flash with headroom for future updates
- The agent **MUST** flag any firmware that lacks fail-safe handling for documented hazards
