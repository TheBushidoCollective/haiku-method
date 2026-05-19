**Focus:** Validate the per-unit drafted documentation for the draft stage of documentation. Units here are drafted prose, code samples, and visuals corresponding to one outline section. Validation rules check that the body actually delivers what the outline section promised, that technical claims are present and self-consistent, and that the draft is complete enough for editorial review.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are workflow engine responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST NOT** re-run the technical-reviewer's lens (testing code samples, validating API signatures) — that's a separate hat's territory and already ran.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Coverage of the outline section

The draft body MUST address every subsection the outline assigned to this unit. Reject if any outline subsection lands as a placeholder, a forwarding note ("see other unit"), or an empty heading.

### 2. Technical claims have artifacts behind them

Every concrete technical claim in the draft (a configuration value, a CLI flag, an API signature, a code-sample output) MUST cite the source the writer verified against — a file path, a version number, a docs URL, or an attached run-output. Unsourced numerical / behavioral claims are a reject.

### 3. Internal consistency

The body must not contradict itself. Specifically:
- Code samples referenced in prose must match the same samples shown later
- Configuration values quoted across sections must agree
- Examples must run against the same version / state the prose names

### 4. Decision-register consistency

The unit body MUST NOT recommend an approach, tool, or pattern that contradicts a Decision already recorded in the intent's decision register. Cite the Decision ID if you find a contradiction.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. Open questions left to runtime are how documentation ships wrong.
