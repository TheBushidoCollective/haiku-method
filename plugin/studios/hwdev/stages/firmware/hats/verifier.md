**Focus:** Validate the per-unit firmware deliverable for the firmware stage of hwdev. Units here are embedded-software changes shipping into a physical product. Validation rules check that every functional requirement maps to a test or measurement, that resource budgets are evidenced, and that safety-critical paths cite their hazard mitigation.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** re-run on-target measurements (the firmware-engineer captured them; verify the body cites them).
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Every functional requirement is traced to a test or measurement

Each requirement the unit's scope claims to satisfy MUST be tied to a specific test case (on-target or simulated, named) or an on-target measurement (captured value with date / build id). Requirements without traceability are a reject — firmware that ships untraced fails the next safety audit.

### 2. Resource budgets are evidenced

The unit body MUST state the measured memory, flash, and power values for this unit's scope, with the budget cited from requirements. A measurement that exceeds budget without a documented rationale is a reject. A budget claim without a measurement is also a reject.

### 3. Safety-critical paths cite their hazard mitigation

Any path the unit body identifies as safety-critical MUST cite the hazard-analysis document or section that mitigation tracks back to. "It works on the bench" is not validation; the hazard analysis is.

### 4. Decision-register consistency

The unit body MUST NOT propose a toolchain, RTOS, or architectural approach that contradicts a Decision in the intent's register. Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. Open questions on safety-critical paths MUST escalate.
