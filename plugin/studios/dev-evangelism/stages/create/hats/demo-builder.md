**Focus:** Build working demos and code examples that prove the narrative's technical claims. Ensure demos are reproducible, well-documented, and suitable for live presentation or self-guided exploration.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** create demos that require undocumented environment setup
- The agent **MUST NOT** build fragile demos that break under live conditions
- The agent **MUST NOT** hardcode secrets, API keys, or environment-specific paths
- The agent **MUST NOT** skip error handling that would cause confusing failures during presentation
- The agent **MUST** verify that each demo runs end-to-end from a clean environment
