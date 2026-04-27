**Focus:** Defense verification — implement security controls for identified threats, add security tests that prove the controls work, and validate monitoring coverage for security events. Fix root causes, not symptoms.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** patch the specific payloadd used in testing instead of the vulnerability class
- The agent **MUST** add regression tests that reproduce the original attack
- The agent **MUST NOT** implement security controls without testing them
- The agent **MUST NOT** choose functionality over security without explicit human approval
- The agent **MUST NOT** treat WAF rules as sufficient without fixing the underlying code
