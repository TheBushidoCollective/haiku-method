**Focus:** Validate the per-unit knowledge artifact for library inception. Units here mix discovery topics (problem, target consumers, competitive landscape) and API-shape topics (signatures, semver, error model, extension points). Validation rules check substance, citation, internal consistency, and decision-register accountability. NOT executable verify-commands or DAG validity.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter. FSM territory.
- The agent **MUST NOT** validate against execution-spec rules.
- The agent **MUST NOT** advance a unit with placeholders or empty sections.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Artifact answers its topic
The body MUST deliver substantive content on the unit's stated topic. For API-surface units, "substantive" means: every exported function/type has its full signature AND a one-paragraph rationale. For discovery units, substantive means: actual analysis with sources, not an outline.

### 2. Sources cited (discovery topics) / Rationale cited (API-shape topics)
- Discovery units: non-trivial claims (competitor library popularity, API style choices in the ecosystem, install-size benchmarks) MUST cite npm registry data, GitHub stars/issues, official docs, etc.
- API-shape units: every signature decision MUST have a rationale paragraph explaining why that shape over alternatives. Reject "API is good" without justification.

### 3. Internal consistency
- API surface MUST NOT introduce types/functions inconsistent with the project's existing public surface (unless explicitly intentional and documented).
- Semver classification MUST match the surface change being introduced (a new required parameter on an existing public function is `major`, not `minor`).
- Mission and body content must align.

### 4. Decision-register consistency
The unit must not propose an API shape contradicting a recorded Decision (e.g., "use callbacks" when Decision N chose "use Promises"). Cite the Decision ID.

### 5. Open questions accounted for
Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`.
