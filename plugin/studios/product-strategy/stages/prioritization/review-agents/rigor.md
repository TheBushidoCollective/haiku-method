---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the prioritization is defensible — applied consistently, grounded in evidence, free from undisclosed bias, and explicit about trade-offs. Prioritization that survives this lens survives stakeholder pressure later; prioritization that doesn't gets unwound mid-roadmap.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Framework consistency** — The chosen framework (RICE, ICE, MoSCoW, weighted scoring, or another the team uses) is applied to every opportunity in scope with the same rules and weights. Mid-list rule changes or silent re-scoring are findings to file.
- **Evidence per score** — Every per-dimension score cites evidence — a user-research insight, a discovery finding, a stakeholder source. "Team intuition" or unsourced estimates are findings to file.
- **Confidence honesty** — Low-confidence scores are flagged as such, not buried inside precise-looking numbers. A 7.2 with weak evidence misrepresents the underlying signal.
- **Stakeholder-override discipline** — Where a stakeholder preference moved a score against the framework's output, the override is documented with the stakeholder's name, the reason, and the dimension affected.
- **Dependency reflection** — Where prioritized items have technical or sequencing dependencies, the priority order respects them or names the trade-off explicitly.
- **Explicit deprioritization** — The unit names what was deprioritized and why. Silent omission of deprioritized items is the most common source of post-roadmap stakeholder friction.
- **Trade-off visibility** — Every "high priority" item that conflicts with another high-priority item has a named trade-off, not a denial that the conflict exists.

## Common failure modes to look for

- A scoring table where every dimension was applied consistently except for one item where the rule quietly changed
- High scores on Impact with no citation back to user-research signal
- Confidence column missing entirely, or every row marked "high confidence" with no reason
- A ranking that treats independent items as if they had no dependencies on each other
- A top tier where everything is "must" — no real prioritization happened
- Deprioritization list missing or limited to items nobody wanted anyway, so the visible trade-offs look smaller than they are
