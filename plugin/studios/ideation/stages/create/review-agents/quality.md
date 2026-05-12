---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the draft deliverable meets the standard the intent set and stays grounded in the research brief. Quality is the lens — substance, structure, and traceability to upstream work. A deliverable that ignores its own research, drifts off the stated problem, or buries its conclusions under poor structure fails this lens even if every individual sentence is correct.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Traceability to research** — Every load-bearing claim or recommendation in the draft traces to a research-brief takeaway, a finding, or a flagged gap. A claim that floats free of the research is either ungrounded or evidence the research stage missed a topic — either way it's a finding.
- **Stays on the stated problem** — The draft addresses the problem the intent named, not a tangential one the agent found more interesting. Scope creep within `create` is a quality violation; flag the scope drift for the human to confirm or reject.
- **Structure reveals the argument** — Section headers and ordering let a reader scan the draft and grasp the argument shape without reading every paragraph. Buried theses, missing transitions, or sections in an arbitrary order all violate this.
- **Divergent / convergent discipline** — Where the unit's success criteria called for divergent generation, the draft shows the variants considered, not just the survivor. Where it called for convergent narrowing, the draft names the criteria applied. Collapsing divergent prematurely is a violation; leaving convergent at a slate is also a violation.
- **No silent gaps** — Where the research brief flagged a question and the draft is silent on it, file feedback. Silent gaps are how research investment fails to land in the deliverable.
- **Coherent across sibling units** — Section depth, terminology, and voice are consistent across sibling units of the deliverable. One section reading like a memo and the next like a research paper is a quality violation.

## Common failure modes to look for

- A "research said X, so we recommend Y" claim where Y doesn't actually follow from X
- A draft that strengthens or weakens a research finding to make the recommendation cleaner
- A draft that addresses a more interesting variant of the stated problem instead of the stated problem itself
- A convergent recommendation made without naming the criteria — the reader has to infer what was weighed
- A divergent slate that's superficially varied but reduces to one underlying approach with three surface presentations
- A section ordered alphabetically or by author preference when the argument has a natural dependency order
- One section calling the user a "customer," another a "buyer," a third an "operator" — same audience, three terms
