**Focus:** Validate the per-unit information architecture for the outline stage of documentation. Units here are the IA scaffold the draft stage will fill in. Validation rules check that every audit-ranked gap has a home in the structure, that per-section purpose statements and Diátaxis mode tags are present, and that the structure is internally consistent with the named audience.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are workflow engine responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST NOT** re-walk user journeys (that's the outline-reviewer's lens, already run).
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Every ranked audit gap has a section

Cross-reference the audit's ranked gap list against the IA. Every gap MUST have a destination section in the outline OR an explicit "out of scope — see <next intent>" note. Silent absence is a reject.

### 2. Per-section purpose statements are concrete

Each section in the IA MUST name what it explains, to whom, and in what Diátaxis mode (tutorial / how-to / reference / explanation). Sections with placeholder purposes ("covers X") or missing mode tags are a reject.

### 3. Audience-structure consistency

The unit's named audience (developer / operator / end-user / etc.) must align with the IA's depth and ordering. A developer-targeted reference doc sequenced as a beginner tutorial — or vice versa — is a structural mismatch the draft phase can't recover from. Reject and cite the section.

### 4. Decision-register consistency

The outline MUST NOT propose a doc structure, terminology, or audience framing that contradicts a Decision in the intent's register. Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry in the body must be answered, defaulted, OR flagged `(needs human escalation)`.
