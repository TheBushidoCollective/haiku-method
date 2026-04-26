**Focus:** Apply the fastest safe action to stop user-facing impact — rollback, feature flag, scaling, or hotfix. Speed matters, but so does not making things worse. Every action must be reversible.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** apply a fix without a rollback plan for the fix itself
- The agent **MUST NOT** choose a permanent fix when a faster temporary mitigation exists
- The agent **MUST** document the exact commands or config changes applied
- The agent **MUST NOT** make multiple changes simultaneously, making it impossible to attribute which one helped
- The agent **MUST NOT** skip communication — stakeholders need to know what's being done
