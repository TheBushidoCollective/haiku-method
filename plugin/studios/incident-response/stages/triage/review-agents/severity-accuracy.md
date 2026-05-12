---
interpretation: lens
---
**Mandate:** The agent **MUST** verify severity classification and blast-radius assessment match the measured user impact and dependency surface, and that the escalation path matches the declared severity tier.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Severity matches impact** — The declared severity tier (SEV-1 / SEV-2 / SEV-3) is consistent with the measured impact number in the brief. A SEV-1 declaration with sub-1% impact is over-classified; a SEV-3 with significant revenue or regulatory exposure is under-classified. Both are findings.
- **Blast radius is one hop deep** — The blast-radius list includes downstream dependencies that consume the failing surface, not just the surface itself. A failing auth service that doesn't list "all surfaces requiring auth" as at-risk is missing the dependency walk.
- **Escalation matches severity** — The brief names the escalation path (who's paged, who's notified) and that path matches the tier. SEV-1 without exec / leadership notification on the comms plan is a finding; SEV-3 paging every on-call is a finding.
- **Roles are named** — IC, scribe, and comms lead are named individuals or rotation slots, not "TBD." For SEV-1, deputy IC is also named.
- **Confirmation source is named** — The brief states how the signal was independently confirmed (second observability source, customer report, manual reproduction). A brief that just cites the original alert is unconfirmed.
- **User-facing symptom is in plain language** — The symptom describes what the user sees, not what the system reports internally. This drives customer comms downstream.

## Common failure modes to look for

- Severity declared on alert content alone, without a measured user-impact number
- Blast radius that lists only the failing component, missing the consumers that share its failure mode
- Comms cadence and channels declared but no comms-lead named — "comms will go out" is not an assignment
- Under-classification driven by reluctance to page leadership ("let's call it SEV-2 to avoid waking people up") when impact justifies SEV-1
- Over-classification driven by a noisy alert that ended up affecting nobody — under-investigated, declared anyway
- Confirmation source missing — the brief reads as if the responding hat just trusted the alert and never went ground-truth
- "Users are affected" or "many requests failing" as the impact number — vague numbers don't justify a tier
