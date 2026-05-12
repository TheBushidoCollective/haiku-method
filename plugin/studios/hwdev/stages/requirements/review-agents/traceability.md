---
interpretation: lens
---
**Mandate:** The agent **MUST** verify every requirement is traceable backward to a user need from inception and forward to a verification approach the validation stage can author tests against. Traceability gaps caught here are corrections; the same gaps caught at validation become "untestable requirement" findings that block release.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Unique identifiers** — Every requirement has a unique ID in the project's declared scheme. ID collisions across units are a hard failure.
- **Backward traceability** — Every requirement traces back to at least one of: an inception finding (user need, market segmentation, business-case driver), a regulatory framework requirement, a safety hazard, an environmental envelope claim, or a recorded decision-register entry. A requirement with no upstream source is a candidate for scope creep.
- **Forward testability** — Every requirement has a verification approach — test type (unit / system / regulatory / field), test method (instrument-based measurement / inspection / analysis / demonstration), and a measurable threshold where applicable. "Verify by inspection" with no inspection criterion is not a verification approach.
- **Cross-unit consistency** — A requirement that references a sibling unit's requirement uses the real ID, not a placeholder. Dangling cross-references (`see REQ-FN-XX`) are a hard failure.
- **Category fit** — Each requirement is in a unit whose category matches it. Functional requirements in safety units, regulatory requirements in functional units, etc., are findings.
- **Coverage map** — Every inception-stage finding that downstream stages depend on has at least one requirement covering it (or an explicit "not covered — out of scope" with rationale). Silent gaps in coverage are how scope drift enters.

## Common failure modes to look for

- A requirement that quotes an inception finding verbatim without giving it a verification approach (the finding is stated; the requirement on top of it isn't)
- A requirement whose verification approach is "verify in validation" with no specifics — that just defers the work
- Two units with the same requirement ID (collision) or two requirements in one unit with the same ID
- A regulatory framework named in the compliance-officer's section that has zero corresponding requirements in the unit — the framework was named but never carried into testable obligations
- An inception finding (target user, market, business-case driver) with no requirement coverage — scope drift if intentional, gap if not
- A `see REQ-FN-XX` placeholder cross-reference that survives into the artifact
