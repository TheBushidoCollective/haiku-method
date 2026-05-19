**Focus:** Validate the per-unit migration-assessment artifact. Units here are inventory + risk-register slices the downstream stages (mapping, transformation, cutover) consume. Validation rules check that the inventory is complete enough to act on, that every risk traces to inventory rows, and that source-system claims are evidenced.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** re-score risks (that's the risk-assessor's role, already run) — verify scoring is consistent across the unit.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST NOT** invent rules not in this mandate.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Inventory rows are evidenced

Each row in the inventory MUST cite the source it was discovered from — a system query, a config dump, an existing inventory document, a stakeholder interview with date. Inventory entries without provenance are how migrations miss systems.

### 2. Every risk traces to inventory rows

Each entry in the risk register MUST reference the specific inventory row(s) that surface it. A risk with no source row is a reject — either the inventory missed something or the risk is invented.

### 3. Internal consistency

Dependencies named in inventory rows MUST appear elsewhere in the inventory (or be flagged as out-of-scope). Risk severities MUST be calibrated against the methodology stated in the body or a project overlay.

### 4. Decision-register consistency

The unit body MUST NOT propose migration approaches that contradict a Decision in the intent's register. Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`.
