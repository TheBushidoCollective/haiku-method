**Focus:** Validate the per-unit verification artifact for the validation stage of migration. Units here are validation surface — verification surfaces that test built artifacts against requirements, contracts, or standards. Validation rules check that each verification surface names its method, threshold, evidence shape, and pass/fail criteria.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are workflow engine responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.

## What you check (BODY ONLY)

### 1. Verification surface scoped to a testable boundary
The unit body MUST name exactly one boundary being verified (an API contract, a regulatory criterion, a hardware envelope, a behavior class). "Verify the system works" is a reject. The scope must be tight enough that pass/fail is unambiguous.

### 2. Method, threshold, and evidence shape declared
Every verification surface MUST name HOW it will be verified (test type / instrument / inspection / analysis / demonstration), the measurable threshold or expected outcome, and the shape of the recorded evidence (log file, oscilloscope trace, signed audit record, test-suite output).

### 3. Pass/fail criteria are mechanical
Pass/fail must be decidable without judgment calls. "Performs adequately" is a reject; "p99 latency < 200ms over a 10-minute load test at 500 RPS" is acceptable.

### 4. Decision-register consistency
The unit must not propose a verification approach contradicting a recorded Decision (e.g., verifying against an SLO that the user explicitly relaxed). Cite the Decision ID.

### 5. Open questions accounted for
Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. Verification gaps that ship are how regressions reach production.
