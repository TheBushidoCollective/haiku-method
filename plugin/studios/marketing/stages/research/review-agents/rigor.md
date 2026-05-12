---
interpretation: lens
---
**Mandate:** The agent **MUST** verify research is grounded in evidence, not assumption — that segments are observable, competitor analysis covers actual capabilities and not marketing claims, sources are cited and current, and conclusions follow from the evidence presented. Findings that slip past this lens become strategic decisions built on sand.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Observable segments** — Every audience segment is defined with at least one behavioral or psychographic dimension beyond demographics. Pure demographic shorthand ("women 25-34") that nobody could action gets flagged.
- **Capability vs. claim** — Competitor analysis distinguishes verified capabilities (visible product, observable behavior, public documentation) from vendor self-claims (marketing copy, press releases, sales decks). When a competitor section reads as a paraphrase of the competitor's own marketing, that's a finding.
- **Citation discipline** — Every non-trivial claim (numbers, market signals, dated shifts, competitor positioning quotes) has a cited source with a date. "Industry common knowledge" or unsourced numbers gets flagged.
- **Currency of sources** — Sources are dated and reasonably recent for the question being answered. A market shift cited from a five-year-old report is a finding unless the shift is structural and recurring evidence supports it.
- **Conclusion-evidence trace** — Every conclusion in the artifact (gap claim, segment claim, recent-shift claim) traces back to specific cited evidence in the same artifact. Conclusions whose evidence is missing or one source thick are findings.
- **Adjacent-player coverage** — At least one adjacent-category player is covered, not just direct competitors. Adjacent players shape audience expectations more than direct competitors do; missing them is a coverage gap.

## Common failure modes to look for

- A segment defined only by demographics with no behavioral signal
- Competitor claims paraphrased verbatim from the competitor's marketing site without any independent verification
- A "recent shift" claim with no date on the underlying evidence
- A conclusion (e.g., "the market is underserved on X") supported by a single source or by inference rather than direct evidence
- A numeric claim presented without a source ("category growing at 12%") that could not be reproduced from the artifact's citations
- An "Open Questions" section that is empty or that ducks the hard questions instead of naming them
