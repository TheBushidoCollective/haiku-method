**Focus:** Apply a structured prioritization framework to the opportunities in scope and produce a defensible ordering. The framework is a tool for surfacing reasoning, not a calculator that produces an answer. Every score has a "because" attached, every weight has a rationale, and every trade-off is explicit.

## Process

### 1. Choose the framework before scoring

Common categories the plugin assumes are available — the team / project overlay picks the specific one:

- **RICE** (Reach × Impact × Confidence ÷ Effort) — works when the team has comparable reach data across opportunities
- **ICE** (Impact × Confidence × Ease) — lighter weight, works for narrower lists
- **MoSCoW** (Must / Should / Could / Won't) — categorical rather than numerical, works for fixed-scope releases
- **Weighted scoring** — multiple custom criteria with team-chosen weights, works when no off-the-shelf framework fits

Confirm the framework choice with the user during elaboration. Record:

- **Why this framework** for this unit's opportunities
- **Weights** for each dimension, with rationale
- **Confidence-handling rule** — how low-confidence scores are flagged (e.g., separate column, halved weight, hypothesis tag)

### 2. Score consistently across the full set

Apply the framework to every opportunity in scope. For each one, capture:

- **Per-dimension score** — the number or category
- **Evidence for the score** — citation back to the user-research insights, the discovery landscape, or a named stakeholder source
- **Confidence** — strong / moderate / weak, with reason
- **Notes** — anything that would change the score under different assumptions

Score every opportunity with the same rule. If an opportunity is unscorable on a dimension, mark it `N/A` and explain why — never silently zero it.

### 3. Surface trade-offs

After scoring, produce the ranking and the **explicit deprioritization list** — what's *not* in the top tier, and why. The deprioritization list is the trade-off made visible. Stakeholders argue much harder with what got cut than with what got included; naming the cut up front turns the conversation from defensive to deliberate.

For each high-confidence ranking decision, write a one-line "because" tying it to evidence. Low-confidence rankings get a "this could move if…" caveat naming the assumption.

### 4. Update the artifact

Append to the unit body:

- **Framework choice and weights** — with rationale
- **Scoring table** — every opportunity, every dimension, evidence, confidence
- **Ranking** — ordered, with per-decision "because"
- **Deprioritization list** — explicit, with reason
- **Open questions** — anything for the stakeholder-proxy or the verifier to pressure-test

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** treat framework scores as objective truth rather than structured judgment
- The agent **MUST NOT** rank by a single dimension (impact only, effort only) without balancing factors
- The agent **MUST NOT** fail to document the reasoning behind weights and scores
- The agent **MUST NOT** hide low-confidence scores behind false precision — a 7.2 with weak evidence is not better than "moderate, low confidence"
- The agent **MUST NOT** avoid hard trade-offs by ranking everything as "high priority"
- The agent **MUST NOT** apply the framework to a subset of opportunities while leaving others unscored
- The agent **MUST** produce an explicit deprioritization list — silence about what got cut is the most common source of stakeholder pushback later
- The agent **MUST** cite evidence for every score; "team intuition" is not evidence
