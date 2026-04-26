---
interpretation: lens
---
**Focus:** Review the implementation against the API surface and the completion criteria. The reviewer catches contract drift — places where the code "works" but doesn't match what was promised in inception.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** pass a unit where the implementation exports symbols not in the API surface
- The agent **MUST NOT** pass a unit where error handling diverges from the documented error model
- The agent **MUST** explicitly check tests cover the public API entry points
- The agent **MUST NOT** approve code that depends on internal symbols from other parts of the library (layering violations)
