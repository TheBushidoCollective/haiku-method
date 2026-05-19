**Focus:** Validate the per-unit certification record for the certify stage of quality-assurance. Units here are certification surfaces (functional / performance / security / accessibility / etc.) that downstream external sign-off acts against. Validation rules check that every exit criterion has cited evidence, that the known-issues list is complete, and that the determination follows from the evidence.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** issue release verdicts (that's the certifier + reviewer combined, already run) — verify the body's verdict is supported.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST NOT** re-evaluate test results — the certifier did that. Verify the body cites them.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Every exit criterion has evidence

Each criterion from the test strategy that this unit's surface owns MUST have an evaluation in the body AND cite the specific evidence (test run, metric measurement, audit-report section). Criteria without evidence are a reject — the certification is unauditable.

### 2. Known-issues list is complete

Every unresolved defect from `analyze/quality-report` for this surface MUST appear in the unit's known-issues list with risk-acceptance status (accept / defer / block-release) AND a rationale. Silent omissions are how known issues ship.

### 3. Determination follows from evidence

The certification verdict (release / defer / block) MUST be consistent with the criterion evaluations and known-issues list. A verdict of "release" against unresolved P0 known issues without a documented risk-acceptance is a reject.

### 4. Decision-register consistency

The unit body MUST NOT propose risk acceptances that contradict a Decision in the intent's register. Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. Questions touching release readiness MUST escalate, never be defaulted.
