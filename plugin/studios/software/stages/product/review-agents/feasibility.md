---
interpretation: lens
---
**Mandate:** The agent **MUST** challenge whether the specified behavior is implementable as written, within the technical constraints established by upstream design and inception stages. Specs that look complete but require disproportionate effort, conflict with existing schemas, or assume impossible capabilities produce a different failure mode than coverage gaps — they pass review and then stall in development. This lens catches them before they ship downstream.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Performance targets are realistic** — Response times, throughput, and concurrency claims align with the data model and existing infrastructure. `Page loads in < 200ms` for a screen that requires three joins across an un-indexed table is infeasible without a stated indexing or caching plan.
- **No silent breaking schema changes** — Every contract change in `DATA-CONTRACTS.md` is compatible with existing schemas, or is paired with an explicit migration plan in the AC. Renaming a field, narrowing a type, or removing nullability from an existing column is a breaking change and MUST call out the migration approach.
- **Edge cases have defined behavior, not just intent** — "Handle gracefully" is not feasible; it's a placeholder. Every edge case names the specific behavior (a status code, an empty state, a fallback value, a queued retry).
- **No assumed-impossible capabilities** — Specs don't require capabilities that aren't in the inception knowledge or the design output. If the spec assumes a third-party service that wasn't named in inception, file feedback against upstream — the assumption needs to be made explicit before this stage approves.
- **Auth and permission specs are implementable against the existing identity model** — The roles, scopes, and permission shapes in the spec match the system's existing auth model, or the spec calls out the auth-model change explicitly.
- **Concurrency / ordering / idempotency are specified for any contract that needs them** — Any endpoint that mutates state, any event in the contract, and any retry / job mechanism has explicit ordering, idempotency, and concurrency-failure semantics. Silence here becomes race conditions in production.

## Common failure modes to look for

- A spec that calls for a capability whose cost (in latency, storage, or compute) hasn't been considered
- A new endpoint that conflicts with an existing path / verb combination
- A `.feature` scenario whose `Given` requires data state the database can't actually produce
- A data contract that adds a not-null column to an existing table with no backfill or default specified
- An error scenario that catches an error the system can't actually throw (e.g., catching a network error in a synchronous local call)
- A boundary case ("max 10,000 items") with no statement of how the system behaves at and beyond the boundary
