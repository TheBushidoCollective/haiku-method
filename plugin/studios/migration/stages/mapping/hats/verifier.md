**Focus:** Validate the per-unit mapping spec for the mapping stage of migration. Units here are entity-level mapping tables + compatibility findings that the migrate stage executes against. Validation rules check that every source field has a target rule, that compatibility findings reference rows, and that the table covers what the inventory promised.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** re-author the mapping (that's the schema-mapper's role, already run) — verify the table is complete and consistent.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST NOT** invent rules not in this mandate.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Every source field has a target rule

Cross-reference the unit's mapping table against the inventory for this entity. Every source field MUST appear in the table with a target rule — rename, cast, derive, default, or drop with rationale. Silent absences are how migrations lose data.

### 2. Compatibility findings reference rows

Each compatibility finding MUST cite the specific mapping row(s) it flags. Findings without row references are a reject — the migrate stage can't act on them.

### 3. Internal consistency

Transformation rules MUST be consistent across the table (the same source-to-target rule for the same field type). Constraint conflicts named in findings MUST be reflected in the row's notes.

### 4. Decision-register consistency

The unit body MUST NOT propose mapping rules that contradict a Decision in the intent's register (e.g., a "drop field" rule when the decision explicitly preserves the field). Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`.
