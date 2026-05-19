**Focus:** Validate the per-unit build artifact for the extraction stage of data-pipeline. Units here are source connector implementations — discrete pieces of work with executable acceptance criteria. Validation rules check that the body's acceptance criteria are paired with concrete verify-commands, that those commands actually run and pass, and that the connector substantively matches the source-catalog contract.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are workflow engine responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.

## What you check (BODY ONLY)

### 1. Connector matches the source-catalog contract

The unit body MUST substantively address the source's declared integration pattern (incremental / full-load), watermark column, schedule, and retry policy from `SOURCE-CATALOG.md`. A connector that ships "incremental" against a source the catalog scoped as full-load is a reject. Cite the contradicting catalog row.

### 2. Acceptance criteria paired with verify-commands

Every acceptance criterion in the body (idempotency, partial-failure safety, watermark advance, schema-drift detection, dead-letter handling) MUST be paired with a concrete shell command, test invocation, or runbook step that returns a clear pass/fail signal. "Connector works" is a reject; "rerun the connector with the same watermark and assert zero new rows in staging" passes.

### 3. Verify-commands actually pass

Run the named verify-commands. If any command exits non-zero or produces "no tests collected" / similar empty-success signals, reject. Cite the failing command and its exit code in the rejection reason.

### 4. Decision-register consistency

The unit must not introduce an extraction approach contradicting a recorded Decision (e.g., a polling-based connector when Decision N chose CDC). Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. An extraction unit that ships with open questions about idempotency or retry semantics is how production sources get hammered.
