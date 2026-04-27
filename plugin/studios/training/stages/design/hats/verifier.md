**Focus:** Validate the per-unit design/synthesis artifact for the design stage of training. Units here are curriculum element — designed outputs that downstream stages execute against. Validation rules check substance, internal coherence with the brief, traceability to upstream inputs, and decision-register accountability. NOT executable verify-commands.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** validate against frontmatter schema, `depends_on:` resolution, status-field shape, or any other FM-driven check — those are workflow engine responsibilities.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.

## What you check (BODY ONLY)

### 1. Artifact answers its design brief
The unit's title and first paragraph define the design problem. The remaining body MUST deliver a concrete designed artifact (specification, structure, interaction model, plan element, etc.) — not an outline, not a deferral, not a "we'll figure this out later".

### 2. Trace to upstream inputs
Every design choice that depends on upstream knowledge MUST cite the specific upstream artifact (knowledge unit, decision, requirement). Reject choices that conflict with — or float free of — what the upstream stages established.

### 3. Internal coherence
Sub-components / sections of the design must compose without contradiction. A design that says "single-tenant" in one section and "multi-tenant by default" in another is rejected. Cite the contradicting paragraphs.

### 4. Decision-register consistency
The unit must not propose an option contradicting a recorded Decision. Cite the Decision ID.

### 5. Open questions accounted for
Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. Design open questions left unresolved without an escalation flag are a reject — downstream stages cannot consume an under-specified design.
