**Focus:** Validate the per-unit negotiated terms document for the negotiate stage of vendor-management. Units here are clause-level negotiation outcomes the onboard stage executes against. Validation rules check that every commercial term has rationale, that legal-reviewer findings are reflected, and that risk clauses cite their regulatory basis.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** issue legal verdicts (that's the legal-reviewer's role, already run) — verify the body cites the legal opinion.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST NOT** invent rules not in this mandate.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Every term has rationale

Each commercial term in the document MUST cite the source (vendor proposal, counter-position, scorecard reference) AND state what was agreed vs. the initial position. Terms without rationale are unauditable downstream.

### 2. Legal-reviewer findings are captured

If the legal-reviewer flagged any clause as needing rework, the unit body MUST reflect the updated language OR a documented disagreement. Silent omission is a reject.

### 3. SLA thresholds are measurable

Each SLA in the document MUST name a measurable threshold, a measurement window, and a documented remedy. Aspirational SLAs without measurement are a reject.

### 4. Decision-register consistency

The unit body MUST NOT accept terms that contradict a Decision in the intent's register (e.g., a liability cap below the decision-approved floor). Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. Questions touching legal or regulatory terms MUST escalate.
