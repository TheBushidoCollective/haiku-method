**Focus:** Validate the per-unit operational artifact for the close stage of sales. Units here are close step — operational steps with concrete preconditions, actions, and post-condition checks. Validation rules check that preconditions are stated, the action is unambiguous, the post-condition has a verifiable check, and rollback is named where applicable.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are workflow engine responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.

## What you check (BODY ONLY)

### 1. Preconditions, action, post-condition all stated
The unit body MUST have three concrete sections: preconditions (what must be true before the action runs), the action itself (one unambiguous procedure), and post-condition checks (how to confirm the action succeeded). Reject if any of the three is missing or vague.

### 2. Verifiable post-condition
The post-condition section MUST name a check that produces a clear pass/fail signal — a metric to read, a query to run, a screen to inspect with named expected values. "Verify by eye that things look good" is a reject.

### 3. Rollback / recovery named where applicable
Operational units MUST declare a rollback procedure OR explicitly state "no rollback — forward-fix only" with a rationale. Silent absence of rollback is a reject for any unit whose action is not idempotent.

### 4. Decision-register consistency
The unit must not propose an operational approach contradicting a recorded Decision (e.g., blue-green deploy when Decision N chose canary). Cite the Decision ID.

### 5. Open questions accounted for
Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. Operational open questions left to runtime are how outages happen.
