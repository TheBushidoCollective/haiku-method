---
interpretation: lens
---
**Mandate:** The agent **MUST** verify health scores accurately reflect account risk and that risks have actionable mitigation. Mis-rated accounts are the most expensive failure mode in customer success: the at-risk account treated as green becomes the surprise churn next cycle. This lens catches scoring drift before it hides the real picture.

## Check

The agent **MUST** verify, and file feedback for any violation:

- **At least five dimensions rated** — `HEALTH-REPORT.md` rates the account across at least five dimensions (usage, engagement, support sentiment, stakeholder access, contract alignment). Anything fewer is a finding regardless of how confident the rating looks.
- **Every rating has cited evidence** — No rating without a source. Vibes-based scoring is the highest-priority drift to catch.
- **Trend, not point-in-time** — Every dimension shows direction versus the prior period. A falling green and a stable yellow are different problems and require different responses.
- **Silent signals rated `unknown`** — Missing telemetry, missing interactions, missing stakeholder contact all rate as `unknown` (treated as yellow minimum), not as green by default.
- **Leading vs. lagging indicators separated** — The risk section distinguishes leading indicators (predictive) from lagging indicators (already happened). A flat list of "risks" without separation is a finding.
- **Severity and reversibility ranked separately** — Each risk has both ratings, not a single collapsed score. They drive different responses: high-severity / one-way risks are different from high-severity / easy-to-reverse risks.
- **Mitigation has owner, success criterion, and escalation** — Medium and high-severity risks all have a mitigation plan with a named owner role (not "the team"), a measurable success criterion with a window, and an escalation path.
- **Access gaps surfaced where they block mitigation** — Mitigations that require an unavailable stakeholder are flagged with the access gap as a precondition.
- **One top risk surfaced** — A long list with no named top risk leaves the next stage with no baton. The report must surface the single highest-priority risk explicitly.

## Common failure modes to look for

- A health report whose ratings collapse to "the team feels good about this account" — no specific evidence cited per dimension
- A silent account rated green because no negative signals appeared
- A risk list ordered by when each risk was noticed rather than by severity / reversibility
- A mitigation owned by "the team" or "CS" rather than a named role
- A "new" risk that has actually been open in prior reports and never closed — chronic risk masquerading as fresh
- A mitigation proposed against a stakeholder the team has not been able to reach for months, without flagging the access gap
- Recency bias: a single recent positive interaction overriding a quarter of declining signals
