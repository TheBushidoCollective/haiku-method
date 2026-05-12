---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that qualification scoring is honest and unfilled by optimistic interpretation. Inflated qualification is the single biggest source of forecast error; this lens exists to surface inflation before it lands in the forecast.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Framework consistency** — one named qualification framework (BANT, MEDDIC, GAP, SPIN, CHAMP, or the team's own) is used across every qualification unit in the intent. Mixed frameworks within a deal are an inflation tell.
- **Evidence for every dimension** — each dimension scored has a citation: discovery-call quote with date, prospect filing reference, research-brief anchor. No dimension is scored "strong" without validated evidence (per the qualifier hat's stated-vs-validated rule).
- **Disqualification signals surfaced, not buried** — any fact that contradicts a strong rating is named explicitly under a `## Disqualification Signals` heading. Disqualifiers buried inside positive sections are an inflation tell.
- **Authority is decision-power, not title** — the named economic buyer's decision authority is evidenced (named OKR ownership, named past procurement decisions, named org-chart position), not assumed from title alone.
- **Budget signals are validated, not stated** — a stated-only budget signal (a VP said they have funds) caps the dimension at `partial`. Validated signals (prior procurement, named line item in the prospect's published financials) earn `strong`.
- **Risks have mitigations** — every deal risk named in the brief carries a mitigation plan, not just an acknowledgment. Risk-naming without mitigation is theatre.

## Common failure modes to look for

- A `strong` rating on Authority based on a title without decision-power evidence.
- A `strong` rating on Budget based on "they said they have budget" rather than validated procurement evidence.
- A risk register that lists generic sales risks ("competitive pressure," "timeline slip") without prospect-specific specifics or mitigations.
- A deal brief with no `## Disqualification Signals` heading — qualification that found zero disqualifiers usually means qualification didn't look hard enough.
- A win plan that names only seller-side actions — buying-committee movement plans are missing, which means the strategist hat skipped the political mapping.
- A champion claim without evidence of capital spent (internal introductions made, proposal shared internally, budget fought for). A friendly contact is not a champion.
- Mixed-framework wording in the same intent (one unit scores BANT, another scores MEDDIC) — inconsistency hides which dimensions are unaddressed.
