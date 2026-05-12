---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that all data sources, schemas, volumes, SLAs, and known quality issues are documented end-to-end. Coverage gaps here become hidden assumptions every downstream stage will rely on without knowing it.

## Check

The agent **MUST** verify, and file feedback for any violation:

- **Source inventory completeness** — Every source system named in the intent is listed with owner team, access pattern, auth model, environment tier, rate-limit or quota constraints, and a reliability tier from the owner team (not the docs)
- **Target inventory completeness** — Every target system is listed with its modeling discipline, per-table freshness / completeness / accuracy SLAs, and concurrency constraints
- **Schema coverage** — Every source schema in scope is profiled against actual sampled data, not against documentation. Per column: declared type, observed type, null rate, distinct count, value distribution, encoding / format
- **Variability coverage** — Every variability dimension (region, tenant, version, locale, etc.) has its variants enumerated and the per-variant differences captured
- **Integration-pattern justification** — Every source has an integration pattern picked (full / incremental-with-watermark / CDC / event / paginated-API) with a recorded reason, not a default
- **Type-conflict catalog** — Any column or concept that appears across multiple sources with type or naming inconsistency is recorded with a reconciliation note for downstream stages
- **Volume and growth** — Per source: current volume, current growth rate, peak vs. average, projected 12-month curve
- **SLA quantification** — Every SLA the user named has numbers attached. "As fresh as possible" is a deferred decision, not a SLA — call it out

## Common failure modes to look for

- A source listed without an owner team or point of contact
- A column profiled by "declared type only" with no observed-type or null-rate signal
- An implicit-schema source (JSON / XML / CSV-without-headers / log line) treated as if it had a declared schema
- A SLA stated qualitatively ("good enough") without numbers
- A variability dimension named without its variants enumerated
- An integration-pattern choice with no recorded reason
