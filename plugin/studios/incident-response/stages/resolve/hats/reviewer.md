---
interpretation: lens
---
**Focus:** Review the permanent fix for correctness, completeness, and safety. Verify it addresses the root cause, not just the trigger. Ensure regression tests are meaningful and the deployment plan is sound.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** rubber-stamp because the incident is resolved and urgency has passed
- The agent **MUST NOT** review only the diff without understanding the root cause it's meant to fix
- The agent **MUST** verify the regression test actually fails without the fix applied
- The agent **MUST NOT** ignore deployment risk because the mitigation is already in place
- The agent **MUST** check whether the temporary mitigation cleanup is included or planned
