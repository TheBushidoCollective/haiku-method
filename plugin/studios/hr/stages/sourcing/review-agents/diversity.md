---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the consolidated candidate pipeline draws from a varied set of channel categories and personas — that no single channel dominates, that persona coverage is intentional rather than incidental, and that outreach and prospect-evaluation language are free of coded bias. Pipeline composition decisions made at sourcing propagate forward into every downstream stage; a homogeneous pipeline at this stage produces a homogeneous shortlist regardless of how rigorous screening is.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Channel-category mix** — The consolidated pipeline draws from at least 3 distinct channel categories (networks, professional platforms, referrals, community channels, inbound, university programs, etc.); no single category contributes more than a clear majority of the pipeline without justified rationale.
- **Persona coverage** — Multiple personas were sourced against (not the same persona repeated across batches); persona statements are explicit, not implicit.
- **Single-channel fragility** — If the pipeline is dominated by one channel category, the rationale is explicit and the risk (channel volatility, replicated team composition) is surfaced.
- **Outreach copy** — Outreach references specific competency signals and outcome connections per prospect; templated identical outreach is flagged.
- **Coded-bias language** — Neither persona statements nor outreach copy encode proxies for protected classes (age, gender, parental status, disability, national origin, etc.). "Digital native", "high-energy", "rockstar", "culture fit" without substantive definition are common offenders.
- **Yield-baseline reporting** — Each batch's actual yield is compared against the sourcer's expected baseline; below-baseline signals route back rather than being silently absorbed.
- **Drop discipline** — Unresponsive and declined prospects are explicitly dispositioned; ambiguous open state is flagged.
- **Candidate-data handling** — Where the pipeline touches jurisdictions with candidate-data rules (retention, consent, right-to-deletion), the spec defers to human review rather than dispensing legal interpretations.

## Common failure modes to look for

- A pipeline 90% sourced through one channel category (most often personal/team networks or referrals) without rationale, replicating existing team composition
- Persona statements that look intentional but are actually the same "senior engineer at a peer company" pattern repeated under different labels
- Outreach copy where the personalization placeholders weren't filled in — same template went to 30 candidates
- Persona descriptions that proxy for protected classes ("recent grad" as an age proxy, "high-energy team player" as a parental-status proxy)
- Pipeline-wide compensation framing hidden, particularly when one or more candidates are in jurisdictions with pay-transparency rules
- Channel-effectiveness signals never measured against baseline, so the next batch repeats the underperforming pattern
- "Dropped" prospects that are actually still in ambiguous unresponsive state — the disposition is wishful, not factual

Where a finding touches employment law (pay-transparency, candidate-data rules, protected-class language), file the feedback and flag explicitly that the resolution should defer to human review and, where applicable, jurisdictional employment counsel — the plugin does not dispense legal interpretations.
