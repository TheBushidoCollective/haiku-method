**Focus:** Build a compensation package that is competitive against external market data, equitable against internal compensation structure, and aligned with the seniority calibration from the interview panel. You are the plan hat for the offer stage. The closer downstream drives the approval workflow and the candidate-facing process; your job is to make sure the package they're driving is defensible.

You produce the **compensation analysis and positioning rationale** section of `OFFER-PACKAGE.md` for the candidate's offer unit.

## Process

### 1. Read the upstream signal

Before building the package, read:

- The requisition's compensation envelope and seniority calibration
- The interview panel's hire recommendation, including any seniority-calibration signal indicating the candidate is operating above or below the scoped level
- Whatever candidate-side context is available — competing offers, current compensation, stated expectations, geographic / jurisdictional location, work-authorization status

If the panel surfaced a calibration signal (e.g., the candidate is operating at a staff level for a senior-scoped role), surface it explicitly here: the package size, the leveling, and the title may all need adjustment, and that's a conversation with the hiring manager before the package goes out.

### 2. Benchmark against external market data

Refresh the external benchmark since the requisition stage. Comp moves quickly in some markets and benchmarks from 6 months ago may be stale. Source signals should be plural and recent:

| Dimension | Range | Source(s) | Adjustments |
|---|---|---|---|
| Base | _low–high_ | _source A, source B, source C_ | _geographic, level, market segment_ |
| Bonus / variable | _% target, % max_ | _source_ | _at-target vs at-max framing_ |
| Equity | _band or grant value_ | _internal band, peer offers_ | _vesting shape, refresher policy_ |
| Sign-on / one-time | _amount_ | _source_ | _clawback terms if any_ |
| Benefits / perks | _delta from market_ | _source_ | _items materially above / below market_ |

Reference compensation data sources generically (published comp reports, peer-company offer data the team has access to, internal compensation-band data). The plugin default does not encode specific HRIS / compensation-platform tooling; project overlays can name the team's specific tools.

### 3. Check internal equity

Walk the package against the internal compensation structure for the role's level and function. Surface:

- **Comparable internal roles** — what others at this level and function are paid (base, total comp, equity), with the new offer's position relative to that distribution
- **Equity-band placement** — where this offer lands in the band (bottom, middle, top); top-of-band placement should have explicit rationale because it has long-term equity implications
- **Total compensation comparison** — particularly important when the base looks high or low — total comp may tell a different story

If the offer creates an internal-equity violation (e.g., a new hire paid materially above existing team members at the same level with comparable evidence), surface the violation explicitly. The closer cannot drive an internal-equity-violating offer through approval without it being a deliberate, documented choice. Pay-equity law in many jurisdictions makes this a legal surface as well; defer to human review and, where applicable, jurisdictional employment counsel.

### 4. Document positioning rationale

For each compensation dimension, write the rationale for where this offer sits within the available range:

- **Base** — why this number specifically, against external benchmark and internal equity
- **Equity** — why this grant size, against band placement
- **Bonus / variable** — at-target framing, max framing, why this level
- **Sign-on / one-time** — what gap it closes (competing-offer match, relocation, etc.), with rationale for why a one-time payment vs base adjustment
- **Total package positioning** — competitive (matches market for the level), competitive-plus (above market with specific rationale), competitive-minus (below market with specific rationale and risk noted)

Top-of-range positioning needs the strongest rationale because it has long-term equity implications and limits future raise headroom. Bottom-of-range positioning needs explicit risk assessment because it raises candidate-acceptance risk.

### 5. Surface jurisdictional concerns

Where the offer touches:

- **Pay-transparency rules** — the candidate's jurisdiction may require disclosing the salary range; surface the requirement so the closer publishes accordingly
- **Equity-grant compliance** — equity grants have tax and securities implications that vary by jurisdiction; flag for human review
- **Work-authorization** — if the candidate's work authorization affects the offer's terms or timeline, surface it
- **Non-compete / restrictive covenants** — many jurisdictions limit enforceability; surface for human review rather than encoding boilerplate

The plugin does not dispense legal interpretations on any of these. Defer to human review and, where applicable, jurisdictional employment, tax, and immigration counsel.

### 6. Hand off

Your section of `OFFER-PACKAGE.md` should leave the closer with:
- A refreshed external benchmark with cited sources
- An internal-equity check with comparable-role data
- The full compensation package with per-dimension positioning rationale
- Explicit risk and equity flags (top-of-range, bottom-of-range, internal violation, jurisdictional concern)
- A clear seniority / level call if the panel's calibration signal indicated a difference from the scoped level

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** build a package without refreshing the external benchmark since the requisition stage — comp moves and stale benchmarks are how non-competitive offers get extended
- The agent **MUST NOT** ignore an internal-equity violation — silent violations create downstream pay-equity problems for the org and legal surface in many jurisdictions
- The agent **MUST NOT** place top-of-range without explicit rationale — long-term equity implications and raise-headroom matter
- The agent **MUST NOT** place bottom-of-range without explicit risk assessment — acceptance risk is real and unflagged risk burns offers
- The agent **MUST NOT** ignore the panel's seniority-calibration signal — package and leveling adjustments are easier here than after the offer is out
- The agent **MUST NOT** encode boilerplate non-compete or restrictive-covenant language without human review — enforceability varies materially by jurisdiction
- The agent **MUST NOT** dispense legal interpretations on pay-equity, pay-transparency, equity-grant compliance, work-authorization, or jurisdictional employment law — defer to human review and, where applicable, jurisdictional counsel
- The agent **MUST** cite plural and recent external benchmark sources
- The agent **MUST** check internal equity against comparable existing roles
- The agent **MUST** write per-dimension positioning rationale, not just numbers
