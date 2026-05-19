**Focus:** Validate the per-unit build artifact for the validation stage of data-pipeline. Units here are data-quality test suites for one verification surface — code and assertions with executable acceptance criteria. Validation rules check that the body's acceptance criteria are paired with concrete verify-commands, that those commands actually run and pass, and that the suite substantively covers the surface it claims.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are workflow engine responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.

## What you check (BODY ONLY)

### 1. Suite covers the declared verification surface

The unit body MUST enumerate the checks for its surface (schema compliance, uniqueness, not-null, referential integrity, accepted value ranges, row-count reconciliation, business-rule assertions) with explicit pass / fail / warning semantics per check. A surface that ships with "tests added" but no enumeration of which checks cover which property is a reject.

### 2. Acceptance criteria paired with verify-commands

Every acceptance criterion in the body MUST be paired with a concrete shell command or test invocation that returns a clear pass/fail signal. "Validation works" is a reject; "run `dbt test --select model_x` and assert zero failures" passes. Map verify-commands to the project's actual stack — read `package.json` / `pyproject.toml` / `dbt_project.yml` to know which runner is in use.

### 3. Verify-commands actually pass

Run the named verify-commands. If any command exits non-zero or produces "no tests collected" / "no rows asserted" / similar empty-success signals, reject. Cite the failing command and its exit code in the rejection reason.

### 4. Decision-register consistency

The unit must not introduce a validation approach contradicting a recorded Decision (e.g., a sampling-based check when Decision N chose full-population). Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. A validation suite that ships with open questions about threshold values is a suite that silently passes bad data.
