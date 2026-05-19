**Focus:** Validate the per-unit knowledge artifact for the assess stage of compliance. Units here are control assessment findings — knowledge artifacts that downstream stages (remediate, certify) consume to plan corrective work and demonstrate audit readiness. Validation rules check substance, evidence citation, methodology consistency, and decision-register accountability. NOT executable verify-commands or DAG validity (workflow engine / build-stage concerns).

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are workflow engine responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.

## What you check (BODY ONLY)

### 1. Each in-scope control has a determination with evidence

Every control named in the unit's scope MUST have a determination (met / partial / unmet) AND the specific evidence reviewed to reach it — system configuration, policy document, observed process, log sample, screenshot, interview record. A determination without cited evidence is a reject; the gap report becomes indefensible the moment an auditor asks "how did you know?"

### 2. Risk scoring is consistent across findings

If the unit assigns likelihood + impact scores, the methodology MUST be applied consistently across every finding in scope. Two materially-similar gaps that received different scores without a recorded rationale are a reject — inconsistent scoring breaks the prioritization the remediate stage depends on.

### 3. Internal consistency

The unit's framing (which control framework, which scoping decisions) must align across the body. A finding that contradicts the upstream `CONTROL-MAPPING.md` (e.g., claims a control is out of scope when scoping declared it in) is a reject. Cite the contradicting paragraphs.

### 4. Decision-register consistency

The unit must not propose, default to, or recommend a determination that contradicts a recorded Decision (e.g., re-classifying a control as out-of-scope when the user explicitly kept it in). Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. Unresolved assessment questions left to remediate-stage runtime are how compliance gaps ship into the audit.
