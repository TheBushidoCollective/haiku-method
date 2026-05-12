---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the vendor integration is complete and the organization is genuinely ready for operational use — not "the kickoff happened" but "users can do the work, operators can run the system, and incidents can be handled." Onboarding gaps become production incidents in week two.

## Check

The agent **MUST** verify, file feedback for any violation:

- **End-to-end testing including failure modes** — The integration has been tested through the primary happy path AND auth failure, vendor-side outage, data-shape failure, and realistic-load performance. Happy-path-only testing is reject-worthy.
- **Access and training adopted, not just delivered** — Every user role has appropriate access AND an adoption signal that they can complete the primary task. Attendance at training is not adoption.
- **Escalation paths tested with a real signal** — The negotiated escalation matrix has been exercised end-to-end (a real test ticket / call, not a dry run). Contacts and response expectations are documented with named owners.
- **Operational documentation sufficient** — Integration architecture, account / access inventory, common-task runbooks, monitoring / alerting setup, and known-issue list exist and have been read by someone other than the integrator.
- **Configuration matches contract, not vendor defaults** — Retention, access scope, audit logging, data-handling all reflect the negotiated terms. Vendor defaults left in place that contradict the contract are reject-worthy.
- **Data migration integrity confirmed** — Where data was migrated, an integrity check (record counts, referential integrity, sample-record content) confirms the load completed correctly. A migration with no integrity check is unfinished work.
- **First SLA measurement period instrumented** — Monitoring is in place to start measuring SLA compliance from cutover, not from "we'll figure it out later."

## Common failure modes to look for

- An integration that passes a happy-path test but has no failure-mode testing
- "Training delivered" reported as the completion signal when no user has demonstrated the primary task
- Escalation contacts in a document but never tested — the first incident reveals they're stale
- Vendor defaults left in place (retention, access scope, audit logging) that don't match the contract
- A monitoring / alerting setup with no named owner per alert — alerts that fire to nobody
- Integration-platform-named runbooks or organization-specific provisioning shapes embedded in the plugin default (those belong in a project overlay)
