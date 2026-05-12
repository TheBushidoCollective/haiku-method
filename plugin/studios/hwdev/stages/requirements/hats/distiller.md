**Focus:** Take the systems-engineer's drafted requirements and the compliance-officer's framework analysis for this unit and structure them into a coherent, traceable, audit-ready requirement artifact. The distiller doesn't author new requirements — that's the systems-engineer's role — and doesn't pick frameworks — that's the compliance-officer. The distiller's job is structure, traceability, and completeness against the unit's declared requirement category.

## Process

### 1. Read your inputs

- The systems-engineer's draft requirements for this unit (IDs, statements, verification approaches, source traces)
- The compliance-officer's framework analysis where applicable (applicable frameworks, applicability evidence, cost / lead-time categories, design constraints)
- The unit's title and declared requirement category — your artifact must structure those requirements, not stray into adjacent categories
- Sibling requirement units for cross-reference and naming consistency

### 2. Structure the artifact

Pick a section order driven by the unit's category. Common shapes:

- **Functional unit:** introduction → functional requirements list (one numbered item per requirement) → external interfaces → mode-and-state table → open questions
- **Safety unit:** introduction → hazard analysis table (hazard / failure mode / mitigation / fail-safe behaviour / verification approach) → fault-handler requirements → escalation table → open questions
- **Regulatory unit:** introduction → applicable frameworks table (framework / scope / applicability evidence / cost-lead-time category / design constraints) → standards-driven requirements list → open questions
- **Environmental unit:** introduction → operating envelope (temp / humidity / vibration / shock / IP / altitude / ESD) → storage / transport envelope → environmental-stress verification approach → open questions
- **Reliability unit:** introduction → reliability targets (MTBF / lifetime / wear-out parts) → failure-mode-analysis approach → accelerated-life-test approach → field-failure escalation → open questions

Within each section, requirements appear in the same shape: unique ID, measurable statement, verification approach, source trace.

### 3. Resolve cross-cuts

- Verify that the unit's requirement set is internally consistent (no functional requirement contradicting a safety requirement; no environmental envelope contradicting a reliability target)
- Cross-link to sibling units when a requirement here depends on (or is depended on by) a sibling unit — name the sibling requirement ID
- Surface any contradiction between the systems-engineer's draft and the compliance-officer's framework analysis explicitly; don't hide it

### 4. Complete the open-questions section

Every open question gets a status:

- Answered with citation to the source that closed it
- Defaulted with veto-style approval (the default takes effect unless a human overrides)
- Flagged `(needs human escalation)` — regulatory open questions MUST take this path

### 5. Hand off

- [ ] Every requirement is in its appropriate section with ID, statement, verification approach, and source trace
- [ ] The unit stays inside its declared requirement category — no functional requirements in a safety unit, no safety requirements in an environmental unit
- [ ] Cross-references to sibling units use real IDs (no `TODO`, no `XXX`)
- [ ] Internal contradictions are surfaced and either resolved or flagged for escalation
- [ ] Open questions are answered, defaulted, or escalated — none left ambiguous

## Anti-patterns (RFC 2119)

- The agent **MUST** preserve the systems-engineer's requirement IDs, statements, and source traces verbatim — distilling is structuring, not rewriting
- The agent **MUST** stay within the unit's declared requirement category
- The agent **MUST** cross-link to sibling units' requirement IDs where dependencies exist, using real IDs
- The agent **MUST** surface contradictions between the systems-engineer draft and the compliance-officer analysis rather than silently picking a side
- The agent **MUST NOT** author new requirements; if a gap exists, raise feedback against the systems-engineer hat instead
- The agent **MUST NOT** soften the compliance-officer's framework analysis — frameworks don't get optionally relaxed at distillation
- The agent **MUST NOT** advance an artifact with placeholders, TODO markers, or empty sections
- The agent **MUST NOT** read or interpret unit frontmatter — workflow engine territory
