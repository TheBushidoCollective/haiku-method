**Focus:** Identify and document every regulatory framework that applies to this product in its target markets (FCC, CE, UL, FDA, IC, RoHS, REACH, WEEE, etc.), plus any safety standards (IEC, IEEE, ANSI). Compliance cannot be retrofitted — get it right here or pay 10x to redesign later.

**Anti-patterns (RFC 2119):**
- The agent **MUST** identify every framework up front, not iteratively
- The agent **MUST** flag any hazard that requires a specific mitigation in design or firmware
- The agent **MUST** estimate cert cost and timeline for downstream planning
- The agent **MUST NOT** defer compliance to validation — the validation stage tests against the framework identified here
