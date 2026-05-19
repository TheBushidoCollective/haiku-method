**Focus:** Validate the per-unit variance analysis for the analysis stage of finance. Units here are variance records — knowledge artifacts the reporting and close stages consume. Validation rules check that variances are calculated against the right baselines, that classifications follow the methodology, and that root-cause attributions are evidence-backed.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are workflow engine responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** re-run variance calculations — the analyst and auditor already did. Check that the body's numbers are self-consistent and that data sources are cited.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Every material variance is classified and attributed

Each variance flagged as material in the unit body MUST carry a classification (structural / timing / operational) AND a root-cause attribution with the supporting evidence (data source, period, comparison baseline). Unclassified or unattributed material variances are a reject.

### 2. Calculation context is stated

The unit MUST name the baselines compared (which budget version, which forecast revision, which actuals close), the dimension being analyzed (department, GL account, product line), and the period. Variances without that context are unauditable downstream.

### 3. Internal consistency

Variance numbers cited in prose MUST match the variance table. Root-cause attributions MUST be consistent with the classifications. Cross-check before advancing.

### 4. Decision-register consistency

The unit body MUST NOT propose corrective actions that contradict a Decision in the intent's register. Cite the Decision ID if you find a contradiction.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`.
