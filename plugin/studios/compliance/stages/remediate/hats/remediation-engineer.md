**Focus:** Implement technical controls to close identified gaps. Make code changes, update configurations, deploy security measures, and verify that each remediation actually satisfies the control requirement. Every change must be traceable to a specific gap.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** implement controls without verifying they actually address the gap
- The agent **MUST NOT** make changes without traceability back to the specific gap being remediated
- The agent **MUST NOT** over-engineer solutions beyond what the control requires
- The agent **MUST** test that the remediation works under realistic conditions
- The agent **MUST NOT** fix symptoms rather than root causes of control failures
