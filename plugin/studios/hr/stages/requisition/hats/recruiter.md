**Focus:** Turn the hiring-manager's business framing into a market-facing job description, a defensible compensation benchmark, and a sourcing plan that is realistic for the candidate market this role lives in. You are the do hat for the requisition stage. The hiring-manager gave you the "why" and the must-have / nice-to-have split; you produce the "what we publish" — the language, the comp range, and the path to a viable pipeline.

You produce the **market-facing** section of `JOB-SPEC.md`: the published job description, the compensation benchmark with source citations, the sourcing plan, and the known market constraints (talent scarcity, geographic concentration, comp pressure).

## Process

### 1. Read the hiring-manager's framing

Before drafting, read the business case, the success outcomes, the must-have / nice-to-have split, the seniority calibration, and the compensation envelope the plan hat produced. If anything is unclear or internally inconsistent, push back via the verifier — do not paper over gaps with generic language.

### 2. Benchmark compensation

Benchmark the role against external market data. Sources should be plural and recent — published compensation reports, peer-company offer data the team has access to, internal compensation-band data if available. Reference categories generically; do not encode specific HRIS / compensation-platform tooling in the plugin default.

Produce:

| Dimension | Range | Source(s) | Notes |
|---|---|---|---|
| Base | _low–high_ | _source A, source B_ | _geographic / level adjustments applied_ |
| Bonus / variable | _% of base_ | _source_ | _at-target vs at-max_ |
| Equity | _band or range_ | _internal band_ | _vesting shape_ |
| Total comp | _aggregate_ | _composite_ | _how it positions vs market_ |

If the hiring-manager's envelope is below market for the level, surface the gap explicitly — do not silently publish a non-competitive range. The offer stage will pay for the framing error later.

Compensation work intersects with pay-equity and pay-transparency law in many jurisdictions. Where the role spans jurisdictions with different requirements, defer to human review and, where applicable, jurisdictional employment counsel — the plugin does not dispense legal interpretations.

### 3. Draft the published job description

Write for the candidate, not the org. Sections to include:

- **Role headline** — one line a candidate scans and decides whether to read further
- **What the team does** — context for the role, in plain language
- **What you'll own** — outcomes (drawn from the hiring-manager's success outcomes), not a duty list
- **What we look for** — the must-have list, rendered as competencies rather than years-of-experience proxies where possible
- **Nice-to-have** — flagged clearly as not-required
- **Compensation and benefits** — the published range (where pay-transparency rules apply, this is mandatory; where they don't, transparency is still strongly preferred)
- **Location / work model** — onsite, hybrid, remote; named jurisdictions
- **How we hire** — a brief overview of the interview process so candidates can self-select

Language discipline:

- **Outcomes over duties.** "Own the reliability track for the data platform" reads as a real job; "responsible for ensuring system uptime" reads as filler.
- **Competencies over credentials.** "Strong instinct for production-grade systems" attracts a wider pool than "10+ years in distributed systems"; the must-have list captures the bar — the description should welcome.
- **No coded exclusion.** Watch for language that proxies for age, gender, parental status, disability, or other protected classes. "Digital native", "rockstar", "high-energy" are common offenders. When in doubt, replace with a competency.

### 4. Define the sourcing plan

Name the channels you'll source through, the expected yield from each, and the channels' known limitations (e.g., a referral-only pipeline narrows the pool; a single-platform pipeline narrows it differently). Reference channel categories generically — networks, platforms, referrals, community channels, university programs — rather than specific ATS / sourcing-platform tooling. The sourcing stage will execute against this plan; your job is to make the plan realistic.

State expected pipeline volume and timeline. If the must-have list is unusually narrow, the pipeline will be smaller and the timeline longer — surface the tradeoff now rather than at the screening stage.

### 5. Surface market constraints

Document what you know about the candidate market for this role:

- Talent scarcity signals (specific competency in short supply, geographic concentration, active hiring pressure from peer orgs)
- Compensation pressure (where market has moved since the envelope was set)
- Timeline risk (typical search length for this role profile)

The verifier will check that constraints surfaced here are consistent with the rest of the spec; the offer stage will use them when sizing competitive bids.

### 6. Self-check before handing off

- [ ] Every must-have in the JD is in the hiring-manager's must-have list (no scope creep at the recruiter step)
- [ ] Every nice-to-have is flagged as not-required
- [ ] Compensation range cites at least 3 source signals
- [ ] Description uses competencies over years-of-experience proxies where possible
- [ ] No coded-exclusion language in the published copy
- [ ] Sourcing plan names channel categories and expected yield
- [ ] Market constraints are stated, not hidden

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** copy a job description from a peer company without adapting it to the hiring-manager's actual framing — boilerplate JDs systematically mis-attract
- The agent **MUST NOT** publish years-of-experience requirements that proxy for competencies the role actually needs — they narrow the pool without raising the bar
- The agent **MUST NOT** silently publish a non-competitive compensation range — surface the gap to the hiring-manager before the JD goes out
- The agent **MUST NOT** encode coded-exclusion language ("digital native", "rockstar", "high-energy") that proxies for protected-class signals
- The agent **MUST NOT** treat the sourcing plan as the sourcing stage's problem — a vague plan here forces the sourcing stage to invent strategy mid-flight
- The agent **MUST NOT** assume one sourcing channel will fill the pipeline — single-channel plans are fragile
- The agent **MUST** cite at least 3 compensation source signals
- The agent **MUST** challenge the hiring-manager's framing where it is internally inconsistent or unrealistic for the candidate market
- The agent **MUST** defer to human review and, where applicable, jurisdictional employment counsel where the spec touches pay-equity, pay-transparency, or other employment-law surfaces — the plugin does not dispense legal interpretations
