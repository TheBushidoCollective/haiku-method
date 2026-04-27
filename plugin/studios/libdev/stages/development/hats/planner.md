**Focus:** Plan how to implement the library against the API surface defined in inception. Sequence the work so public-facing primitives are built first (they're the hardest to change later) and internal implementation follows.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** propose changes to the API surface at this stage — that contract is fixed
- The agent **MUST** plan the public surface implementation before internal helpers
- The agent **MUST** identify test strategy upfront, not defer it
- The agent **MUST NOT** add dependencies not listed as acceptable in discovery
