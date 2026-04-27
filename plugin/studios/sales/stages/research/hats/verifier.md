**Focus:** Validate the per-unit knowledge artifact for the research stage of sales. Units here are prospect-research note — knowledge artifacts that downstream stages consume. Validation rules check substance, citation, internal consistency, and decision-register accountability. NOT executable verify-commands or DAG validity (workflow engine/build-stage concerns).

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are workflow engine responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.

## What you check (BODY ONLY)

### 1. Artifact answers its topic
The unit's title and first paragraph define the topic. The remaining body MUST deliver substantive content on that topic. Reject placeholders, content-free outlines, or redirects.

### 2. Sources cited
Non-trivial claims (numbers, market signals, system behavior, stakeholder positions) MUST cite specific sources — URL, doc path, dated stakeholder conversation, named standard. Reject "industry common knowledge" or unsourced numerical claims.

### 3. Internal consistency
Title, mission, and body must align. Numerical/categorical claims must be consistent across the body. Recommendations must follow from the evidence presented.

### 4. Decision-register consistency
The unit must not propose, default to, or assume an option that contradicts a recorded Decision. Cite the Decision ID in any rejection.

### 5. Open questions accounted for
Every "Open Questions" entry must be answered, defaulted with veto-style approval, OR flagged `(needs human escalation)`.
