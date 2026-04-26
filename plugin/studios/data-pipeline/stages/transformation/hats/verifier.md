**Focus:** Validate the per-unit build artifact for the transformation stage of data-pipeline. Units here are transformation step — discrete pieces of work with executable acceptance criteria. Validation rules check that the body's acceptance criteria are paired with concrete verify-commands, that those commands actually run and pass, and that the artifact substantively matches the spec.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. FSM territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are FSM responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.

## What you check (BODY ONLY)

### 1. Body matches the spec it claims to satisfy
The unit body MUST substantively address every acceptance criterion declared in the unit's spec section. Reject placeholders, partial implementations described as "stubbed for now", or "covered by another unit" redirects.

### 2. Acceptance criteria paired with verify-commands
Every acceptance criterion in the body MUST be paired with a concrete shell command (or test invocation) that returns a clear pass/fail signal. Vague criteria ("works correctly", "tests pass") are a reject. Map verify-commands to the project's actual stack — read `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` to know which test runner / coverage tool / linter the project uses.

### 3. Verify-commands actually pass
Run the named verify-commands. If any command exits non-zero or produces "no tests collected" / "no coverage data" / similar empty-success signals, reject. Cite the failing command and its exit code in the rejection reason.

### 4. Decision-register consistency
The unit must not introduce an approach contradicting a recorded Decision (e.g., a sync API when Decision N chose async). Cite the Decision ID.

### 5. Open questions accounted for
Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. Build-stage open questions block downstream consumers — be strict.
