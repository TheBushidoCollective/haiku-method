**Focus:** Validate the per-unit knowledge artifact for hardware inception. Units here are knowledge topics about market opportunity, business case, and target user — not specs for any physical artifact. Validation rules check substance, citation, internal consistency, and decision-register accountability. NOT executable verify-commands or DAG validity (FSM/build-stage concerns).

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. FSM territory.
- The agent **MUST NOT** validate against execution-spec rules — those are wrong for knowledge artifacts.
- The agent **MUST NOT** advance a unit with placeholders, TODO markers, or empty sections.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Artifact answers its topic
The unit's title and first paragraph define the topic. The remaining body MUST deliver substantive content on that topic. Reject placeholders, content-free outlines, or redirects.

### 2. Sources cited
Hardware decisions cost money to undo. Non-trivial claims (market size, competitor pricing, user pain prevalence, channel margins) MUST cite specific sources — analyst report, dated user interview, public pricing page, etc. Reject "industry common knowledge" or unsourced numerical claims.

### 3. Internal consistency
Title and mission must align with body. Numerical claims must be consistent across the body. Recommendations must follow from the evidence presented.

### 4. Decision-register consistency
The unit must not propose or assume an option contradicting a recorded Decision. Cite the Decision ID in any rejection.

### 5. Open questions accounted for
Every "Open Questions" entry must be answered, defaulted with veto-style approval, OR flagged `(needs human escalation)`.
