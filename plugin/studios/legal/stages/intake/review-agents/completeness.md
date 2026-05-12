---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the legal brief captures the matter completely enough that downstream stages can work without re-interviewing the user, and that the risk inventory reflects the fact pattern rather than a generic template. Coverage gaps here cascade — every downstream stage either fills the gap with assumption or stops to ask.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Party identification is complete** — every party in the matter has its legal name, role, and (where applicable) headquarters / formation jurisdiction. Affiliates that the matter implicates are listed, not assumed.
- **Jurisdictional surfaces are explicit** — every jurisdiction relevant to the matter (place of performance, counterparty location, governing-law candidate, dispute venue, regulatory regime) is named with the reason it's in scope.
- **Facts are sourced** — non-trivial fact statements cite their source (named conversation with date, document path, URL). Unsourced facts are flagged in the brief, not hidden.
- **Business context is captured** — the brief explains why the matter is happening now, what the business is trying to achieve, and the timeline pressure. A brief without context drives bad downstream prioritization.
- **Risks are tagged** — every identified risk has both a likelihood and impact tag, traces to a specific trigger fact, and lists generic mitigation options for attorney evaluation.
- **Deal-blockers are surfaced** — risks that would block the deal if unresolved are flagged in an `## Attorney Escalation` section, not buried in the risk table.
- **Open questions are flagged** — every item that requires legal characterization the user couldn't confirm is in an `## Open Questions for Attorney` section.

## Common failure modes to look for

- Risk inventory pulled from generic priors rather than the matter's specific facts (every NDA flagged with the same five risks)
- Party identification by common name without legal name (the entity that actually signs the document is different)
- "Standard governing law" or "usual jurisdiction" — vague phrases that hide an unconfirmed strategic choice
- Risks tagged with "medium" likelihood and "medium" impact uniformly, which is a sign the tagging wasn't substantive
- A deal-blocker buried inside a table row rather than surfaced as escalation
- Facts presented as undisputed when the source is a single stakeholder's assertion
- Mitigation language that's a single recommended action rather than a set of options the attorney can evaluate
