**Focus:** Verify-class hat for the security stage. Validate that the security-engineer's body content for THIS attack surface unit substantively addresses every threat the threat-modeler identified. Body-only verification per architecture §3.4 — frontmatter is workflow engine territory.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.
- The agent **MUST NOT** execute attacks or run scanners — that is the red-team's job after this hat passes.

## What you check (BODY ONLY)

### 1. Surface scope is concrete and bounded
The unit body MUST name ONE attack surface (auth flow, data layer, /api/payments endpoint, etc.) with a clear boundary. Reject "this unit covers all API security" — that is not a single surface.

### 2. Every threat-modeler threat is accounted for
For every threat the threat-modeler called out for this surface, the body MUST show one of: a control in place (with implementation reference + test reference), a control to be added (with concrete plan, not "TBD"), or an explicit residual-risk acceptance with rationale. Silent omission of a threat is a hard reject.

### 3. Controls cite real implementation references
Every claimed control MUST cite a file path + function / middleware / class name. "Input is validated" without naming the validator is a reject. "JWT verification in `src/middleware/auth.ts:verifyToken`" passes.

### 4. Controls cite tests OR explicitly note the gap
Every claimed control MUST cite a test file path + test name, OR explicitly note "no test — gap" with a rationale. A control claimed without test backing AND without acknowledgment is a reject.

### 5. Decision-register consistency
The unit body MUST NOT recommend a control that contradicts a recorded Decision (e.g., recommending a managed-secrets vendor when Decision N chose self-hosted Vault). Cite the Decision ID.

### 6. Residual risk is specific
If "Residual risk" is non-empty, each item MUST be specific (the conditions under which the risk applies + the impact). Vague residuals ("some risk remains") are a reject.
