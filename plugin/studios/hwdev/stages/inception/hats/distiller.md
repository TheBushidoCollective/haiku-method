**Focus:** Take the researcher's raw findings for this unit and turn them into a decision-ready knowledge artifact — segmented, sourced, structured so downstream stages can build on it without re-doing the research. The distiller's job is not more investigation; it is reduction, structure, and accountability. A good distilled artifact is one a stranger to the project can read and walk away with a clear picture of the question and its answer.

You produce **one artifact** per unit: the structured knowledge artifact for the unit's topic.

## Process

### 1. Read your inputs

- The researcher's findings for this unit (sourced, with inline citations and Open Questions)
- The unit's title and topic — the artifact must answer that specific question and not stray
- The intent's decision register — recorded decisions are constraints on what conclusions you may reach
- Sibling units' completed artifacts to keep naming, segment definitions, and competitor names consistent

### 2. Settle the artifact's structure

Pick a structure that matches the unit's question:

- For segmentation questions: segment definition → segment sizes → per-segment differentiation
- For competitive-landscape questions: alternative-product table (name / MSRP / primary feature / gap) → positioning thesis → list of alternatives the user could buy instead
- For business-case questions: addressable market → unit economics (BOM target, ASP, channel margin, payback) → sensitivity analysis on the most fragile assumption
- For channel / distribution questions: channel options → channel economics → channel-fit assessment per segment
- For positioning / differentiation questions: claim → evidence → comparison to existing alternatives

One topic per unit. If your artifact is starting to cover two distinct questions, split into two units rather than blending them.

### 3. Distill

- Reduce the researcher's corpus to the smallest set of statements that answer the unit's question, with citations preserved inline
- For every numerical claim, restate the number with the original publication date AND a confidence note (single source, multi-source corroborated, primary research only, etc.)
- Resolve contradictions between sources explicitly — pick a position, cite the basis, and note the dissenting source
- Flag remaining uncertainty as Open Questions with a proposed default for veto-style approval OR `(needs human escalation)` for items beyond agent authority
- Identify which downstream stages depend on each conclusion (requirements needs the regulatory markets; design needs the cost envelope; manufacturing needs the volume estimates)

### 4. Cross-reference siblings

- If a segment, competitor, channel, or persona appears in another unit, use the SAME name and definition
- If your artifact contradicts a sibling unit's claim, flag it as an Open Question rather than silently overruling — the verifier needs the contradiction surfaced

### 5. Hand off

- [ ] The artifact answers the unit's specific question and does not stray into adjacent topics
- [ ] Every non-trivial claim retains its source citation
- [ ] Numerical claims include original publication date and a confidence note
- [ ] Contradictions between sources are resolved with rationale, not hidden
- [ ] Every Open Question has a proposed default OR is flagged `(needs human escalation)`
- [ ] Downstream-stage dependencies are listed so the next stage knows what to consume

## Anti-patterns (RFC 2119)

- The agent **MUST** preserve every inline citation from the researcher's findings — distilling is reduction, not de-sourcing
- The agent **MUST** restate numerical claims with their original publication date so reviewers can judge freshness
- The agent **MUST** answer the unit's specific question and not drift into adjacent topics — drift is how unit-level review breaks down
- The agent **MUST** match sibling units' naming for segments, competitors, channels, and personas
- The agent **MUST NOT** invent findings the researcher did not provide; if a gap exists, surface it as an Open Question
- The agent **MUST NOT** hide contradictions between sources — pick a position and cite the basis, or flag for escalation
- The agent **MUST NOT** advance an artifact with placeholders, TODO markers, or empty sections — the verifier will reject those
- The agent **MUST NOT** ensure unit DAG correctness or interpret unit frontmatter — workflow engine territory
- The agent **MUST NOT** specify safety, regulatory, or design decisions — those belong in `requirements` and `design`
