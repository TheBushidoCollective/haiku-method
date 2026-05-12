---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the system is observable enough that an on-call engineer with no prior context can diagnose a production issue from telemetry alone. Operations that ship without observability discipline produce 2am pages with no signal — the wrong layer to discover the gap.

## Check

The agent **MUST** verify each:

- **Structured logs with correlation IDs.** Every request / job carries a correlation ID propagated through every downstream call. Log lines are key-value (not free-form prose) so they're queryable.
- **Four golden signals covered.** Latency, traffic, errors, saturation — every user-facing service emits all four. Drill-down dimensions exist for slicing by endpoint / customer / region.
- **Alerts have runbooks.** Every alert that pages a human links to a runbook or a one-line description of the action to take. Alerts without runbooks are noise that gets silenced.
- **Critical-journey dashboards exist.** The top-N user journeys each have a dashboard showing the four golden signals end-to-end across the systems they touch.
- **No sensitive data in telemetry.** Logs and metrics do not include PII, credentials, tokens, full request bodies, or full response bodies for payment / auth flows.
- **Sampling preserves signal at scale.** Where logs / traces are sampled, the sampling strategy preserves all error traces and a representative sample of success traces; it doesn't silently drop the data you'd need to debug an incident.
- **Telemetry survives the failure.** Logs ship to a destination outside the failing process — a crash-looping pod still emits its last lines. Metrics are pushed or scraped on a cadence that survives a partial outage.

## Common failure modes to look for

- A new endpoint added without a corresponding metric or log line — the team finds out it's broken via customer ticket
- Logs that emit JSON-stringified blobs (an entire request body) instead of structured fields
- An alert fires every 15 minutes with no documented action — on-call has muted it
- A dashboard shows green during a known incident because the failing path isn't instrumented
- Correlation ID propagation that drops at a service boundary (gRPC → HTTP, queue producer → consumer), making cross-service tracing impossible
- An error path that silently swallows the exception with no log line or metric increment
- Stack traces dumped into logs include `Authorization:` header values or full SQL with embedded credentials
