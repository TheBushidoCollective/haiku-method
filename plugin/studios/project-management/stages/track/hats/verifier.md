**Focus:** Validate the per-unit tracking artifact for the track stage of project-management. Units here are tracking surface — status entries, variance analyses, issue-log rows, and risk-register updates. Validation rules check that data is current, variance causes are specific, mitigations have execution evidence, and open items have owners and dates.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are workflow engine responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.

## What you check (BODY ONLY)

### 1. Data currency
Every active work package, issue, and risk MUST have an as-of date no older than the current tracking cycle. Stale data carried forward without a re-confirmation note is a reject.

### 2. Specific variance causes
Every work package with ≥ 10% variance on any axis MUST name a specific cause — what changed, what's being done, when it unblocks. Generic causes (`"unforeseen complexity"`, `"resource constraints"`, `"taking longer than expected"`) are a reject.

### 3. Owner-and-date on open items
Every open issue and every mitigation action MUST have a single named owner and a concrete target date (not "soon", "this sprint", "ASAP"). Joint ownership or open-ended dates are a reject.

### 4. Mitigation execution evidence
Every active mitigation MUST cite an observable execution signal (ticket, work package, recurring check-in, monitoring dashboard). Documented-but-not-executing mitigations are a reject — they're false confidence.

### 5. Decision-register consistency
The body must not propose escalations or accept-the-risk decisions that contradict a recorded Decision. Cite the Decision ID in any rejection.
