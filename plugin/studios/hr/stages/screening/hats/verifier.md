**Focus:** Validate the per-unit screening record for the screening stage of HR. Units here are candidate-batch evaluation records — sensitive artifacts the interview stage consumes. Validation rules check that every screening decision carries cited evidence, that scoring follows the requisition's calibration, and that the body does not surface disparate-impact patterns the lens review missed.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** re-score candidates (that's the assessor's role, already run) — verify scoring methodology was applied consistently.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST NOT** issue legal interpretations of employment law — flag concerns and defer to human review.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Every screening decision has cited evidence

Each candidate evaluated in the unit MUST carry a pass / fail disposition AND the specific evidence the screener reviewed — resume section, portfolio link, prior work sample, stated experience with version / scope. Dispositions without evidence are a reject.

### 2. Scoring methodology is applied consistently

The composite scores on the ranked shortlist MUST be calibrated against the methodology stated in the body. Outlier scores without rationale, or two materially-similar candidates with materially-different scores, are a reject.

### 3. Internal consistency

Candidates flagged as edge cases in the screener output MUST appear in the assessor's calibration discussion. The shortlist MUST NOT include candidates the screener disposed as fail without an explicit override rationale. Cross-check both directions.

### 4. Decision-register consistency

The unit body MUST NOT recommend a candidate whose disposition contradicts a Decision in the intent's register (e.g., a candidate explicitly ruled out by the hiring manager appearing on the shortlist). Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. Open questions touching protected-class fairness MUST escalate.
