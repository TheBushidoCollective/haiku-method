---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the assessment stage's inventory and risk register are substantively complete — every system, data store, integration, and ancillary dependency is captured; every risk category has been considered; every risk is paired with severity, likelihood, and a concrete mitigation or accept decision.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Inventory completeness** — every artifact category (entities, data stores, services, integrations, jobs, configuration, ancillary systems like caches / queues / search indexes / audit logs) has rows in the inventory. Categories that don't apply MUST be named with a one-line "not applicable because X" rather than silently absent.
- **Volume estimates present** — every inventory row has a concrete volume (row count, message rate, object count) or an explicit "not measurable because X." Volumes drive migration strategy.
- **Dependency edges captured** — every read consumer and write producer relationship is recorded. An artifact with no edges is half-inventoried.
- **Risk category coverage** — risks cover at minimum: data loss / corruption, downtime / availability, compatibility / functional regression, ordering constraints, human / process, reversibility. A missing category is a finding.
- **Risk-to-inventory traceability** — every risk row cites the inventory row(s) it derives from. Untethered risks are speculation.
- **Severity and likelihood scoring** — every risk has explicit severity and likelihood ratings on the studio's scale, not vague labels.
- **Mitigation per risk** — every risk pairs with a concrete mitigation OR an explicit "accept — residual risk is X" decision. No risk is open-ended.
- **Ordering constraints surfaced** — at least one ordering constraint section names which artifacts must move before which others (or explicitly states "no ordering required because X").

## Common failure modes to look for

- Inventory rows with "TBD" or "unknown" volumes / owners without a follow-up action
- Risk register heavy on technical risks but missing human / process risks entirely
- Risks cited as "low likelihood" without rationale — likelihood ratings need justification
- "Documentation says X" as the only source for an inventory row, with no live-system verification
- Cross-system dependencies recorded on one side only (artifact A says it reads B, but B doesn't list A as a consumer)
- A risk that maps to multiple inventory rows but cites only one
- Mitigations that read like wishes ("we'll be careful") rather than concrete actions
- Reversibility section silent on which steps are irreversible
