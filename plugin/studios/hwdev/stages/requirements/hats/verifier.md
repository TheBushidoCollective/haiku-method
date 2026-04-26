**Focus:** Validate the per-unit requirement-spec artifact for hardware requirements. Units here are requirement domains (functional / safety / regulatory / environmental / reliability) — testable obligations that downstream stages verify against. Validation rules check substance, completeness against the requirement category, and downstream-testability. Hardware requirement defects cascade into PCB redesigns and cert failures — be strict.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter. FSM territory.
- The agent **MUST NOT** validate against build-stage executable verify-commands — requirements are testable obligations specifying what downstream `validation` MUST verify, not commands themselves.
- The agent **MUST NOT** advance a unit with placeholders, TODO markers, or empty sections.
- The agent **MUST NOT** soften regulatory requirements (e.g., advancing a regulatory unit that defers the framework choice). Reject — regulatory frameworks cannot be retrofitted.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Artifact answers its requirement domain
Functional units list functional requirements with measurable outcomes. Safety units list hazards with mitigations and fail-safe behaviors. Regulatory units name the framework, cite the specific section, and prove applicability. Reject placeholders or domain-content gaps.

### 2. Each requirement has a verification approach
Every requirement listed in the body MUST name HOW it will be verified — test type (unit / system / regulatory / field), test method (instrument-based measurement / inspection / analysis / demonstration), and a measurable threshold where applicable. This is what makes downstream `validation` able to author the actual tests.

Acceptable: "Powers on within 500ms of switch press — verified by oscilloscope measurement at TP3 with cold start (system in storage temperature for 24h)"
Bad: "Powers on quickly" (no method, no threshold)

### 3. Internal consistency
- Functional requirements MUST NOT contradict safety requirements (a "high-throughput mode that bypasses overcurrent" is a contradiction).
- Regulatory framework chosen MUST be appropriate for the product class declared in inception (medical device requires FDA/CE-MDR, not just FCC).
- Mission and body content must align.

### 4. Decision-register consistency
The unit must not propose requirements contradicting recorded Decisions (e.g., requiring rechargeable battery when Decision N chose disposable). Cite the Decision ID.

### 5. Open questions accounted for
Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. **Regulatory open questions MUST default to `(needs human escalation)`** — agents do not have authority to defer regulatory framework decisions.
