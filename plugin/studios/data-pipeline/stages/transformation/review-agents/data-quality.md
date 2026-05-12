---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that transformations produce correct, consistent output that matches the data-modeler's spec exactly, and that business logic is centralized rather than scattered.

## Check

The agent **MUST** verify, and file feedback for any violation:

- **Grain compliance** — Every target table's output has the grain the data-modeler declared. One row per <thing> per <period>, exactly
- **Primary-key uniqueness** — Every declared primary key is unique in the output. Surrogate-key derivation is deterministic across runs (hashes of stable inputs, not auto-increment)
- **SCD correctness** — Each dimension implements its declared SCD type. Type 2 dimensions have non-overlapping effective-from / effective-to intervals; Type 1 overwrites preserve no orphaned history
- **Type-conversion explicitness** — Every type coercion is explicit (`CAST(...)`, named conversion function). Implicit coercions hide encoding / precision / timezone defects
- **Null and sentinel handling** — Every nullable column has a stated treatment (preserve / coalesce / filter / raise). Sentinel values (`-1`, `1970-01-01`, `""`, `"N/A"`) are normalized at the typing layer, not buried in business logic
- **Timezone handling** — Every timestamp column declares its source and target timezones. No implicit UTC assumptions
- **Deduplication determinism** — When multiple source rows map to one target row, the "winner" is a stable function of the data, not order-of-arrival
- **Referential integrity** — Foreign keys resolve to existing rows in the referenced table. Orphan-reference rates match the model's stated tolerance
- **Business-logic centralization** — Every business rule the model relies on (revenue recognition, status mapping, derived columns) is implemented in exactly one place, referenced from everywhere it applies

## Common failure modes to look for

- A target table whose actual grain differs from the declared grain (declared "one row per order"; output has duplicates per order)
- An auto-increment surrogate key that produces different IDs on every run
- A Type 2 dimension with overlapping effective-period intervals
- An implicit type coercion buried in a join condition
- A timestamp column whose timezone treatment is "whatever the source returned"
- The same business rule implemented twice with subtly different logic in different transformations
- A deeply nested subquery instead of named intermediate steps, making the transformation un-reviewable
