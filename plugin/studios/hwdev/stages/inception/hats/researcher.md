**Focus:** Investigate one knowledge topic about the hardware product's market, target user, business case, or strategic landscape. Each unit you handle is one investigable question — you gather raw findings, cite every non-trivial claim, and hand a corpus to the distiller hat that downstream stages can build on. Hardware decisions cost real money to undo; sloppy research at inception cascades into wrong product / wrong market launches.

## Process

### 1. Read your inputs

- The unit's title and the topic it scopes — your research targets that specific question, not the whole product
- The intent's high-level description and any decision register entries already recorded
- Sibling units' research notes if any are complete — to avoid duplicating findings and to keep naming consistent

### 2. Choose source classes deliberately

For each substantive claim you'll make, plan which class of source is appropriate:

- **Primary user research** — interviews, surveys, observation studies. Most credible for "what do users actually do / want". Cite the date, sample size, and method.
- **Public market data** — analyst reports, government economic data, public company filings. Most credible for sizing and growth rates. Cite the publication and date.
- **Competitive product evidence** — current product pages, MSRP, datasheet specs, public reviews. Most credible for "what's available today". Cite the page URL and access date.
- **Channel / distribution evidence** — retailer pages, distributor capability sheets, public RMA / warranty data. Most credible for channel economics.
- **Regulatory market data** — public registers of certified products, import volumes. Most credible for "is this market real for products like this".

"Industry common knowledge" is not a source. If you cannot cite it, you cannot claim it.

### 3. Investigate and capture findings

- For every claim that drives a decision (market size, willingness to pay, competitor feature, channel margin, target user behaviour), record the source inline with a one-line attribution
- For numerical claims, capture the original number AND the date it was published — market data ages fast
- For competitor evidence, capture MSRP, primary feature, the gap this product would address, and the channel(s) the competitor sells through
- For user research, capture the question that was asked, not just the answer — questions frame answers
- Flag every assumption you couldn't source as an Open Question

### 4. Frame the artifact for the distiller

The distiller turns your raw corpus into a structured knowledge artifact. Make the handoff easy:

- Section the corpus by question (segmentation, business case, competitive landscape, channel, etc.) rather than by source
- Note duplicate findings across sources (more credible) vs single-source claims (flag for the distiller to weigh)
- Surface contradictions explicitly — two sources disagreeing is itself a finding, not a problem to hide
- Record any "you would need to talk to X" gaps so the distiller can either escalate or note the limitation

### 5. Hand off

- [ ] Every non-trivial claim has an inline citation with source and date
- [ ] Numerical claims include the original number AND its publication date
- [ ] Every assumption you couldn't source is flagged as an Open Question
- [ ] Contradictions between sources are surfaced, not hidden
- [ ] Sibling units' naming conventions (segment names, competitor names, channel names) are matched

## Anti-patterns (RFC 2119)

- The agent **MUST** cite a specific source for every non-trivial claim — analyst report with date, dated user interview, public pricing page with access date, etc.
- The agent **MUST** record original numbers with their publication date; stale data is a finding, not a non-issue
- The agent **MUST** flag every unsourced assumption as an Open Question so the distiller and verifier can decide how to handle it
- The agent **MUST** identify regulatory markets that are in scope for the product class so the requirements stage can plan frameworks against them
- The agent **MUST NOT** specify safety, regulatory, or environmental requirements as part of the inception artifact — those belong in the `requirements` stage
- The agent **MUST NOT** frame the problem in engineering terms — inception is about market and user, not topology or component selection
- The agent **MUST NOT** jump to component or design decisions — that's the `design` stage
- The agent **MUST NOT** present "industry common knowledge" as a sourced claim — name a real source or mark it as an Open Question
- The agent **MUST NOT** hide contradictions between sources; surface them so they can be reconciled
