---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that every launch unit is operationally ready to fire — preconditions are verifiable, the action is unambiguous, the post-condition check produces a clear pass / fail signal, tracking and attribution are confirmed, and a rollback or forward-fix path is named. Launch readiness gaps that slip past this lens become public-facing incidents.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Precondition completeness** — Every launch step states asset readiness, infrastructure readiness, channel readiness, audience readiness, and required approvals. Implicit preconditions ("obviously the landing page should be up before paid traffic starts") are findings — implicit is how launches break.
- **Tracking and attribution confirmation** — Tracking pixels, attribution parameters, and analytics tags for each launch step are explicitly listed as preconditions AND named in the post-condition check. Steps that activate paid traffic before tracking confirmation are findings.
- **Action specificity** — Each step's action section names one specific operation with a verb, a channel category, an owner, a time or trigger, and an idempotency note. Multi-action steps ("publish landing page AND activate ads AND send email") are findings — split required.
- **Post-condition verifiability** — Each step's post-condition check names a specific signal (metric, query, screen, ping), the source, the expected value or range, the time window, and the negative-case signal. "Verify by eye" or "looks good" are findings.
- **Rollback / forward-fix named** — Each non-idempotent action has a rollback path with named trigger criteria and owner, OR explicitly states "no rollback — forward-fix only" with rationale and the forward-fix procedure. Silent absence of either is a finding.
- **Dependency sequence integrity** — Dependencies between launch units are explicit; sequences match channel-category requirements (e.g., DNS / cache propagation windows respected, tracking-system processing lag respected, paid-traffic budget readiness confirmed before activation).
- **Contingency for negative reception** — Where the campaign carries reputation risk (any public-facing activation), the unit names a monitoring window and a response procedure for negative signals — public complaints, brand-safety triggers, channel-category policy violations.

## Common failure modes to look for

- A unit that publishes paid traffic before naming the tracking pixel and confirming it fires
- A unit whose "rollback" is a single sentence with no trigger criteria and no owner
- An action section that combines three operations ("publish + activate + notify") into one step
- A post-condition that says "monitor performance" without naming what signal would tell you to pull
- An approval listed as a precondition without naming who provides it
- A launch sequence whose ordering assumes a same-day channel activation but doesn't account for channel-side processing time
- A non-idempotent action with no rollback and no forward-fix procedure
