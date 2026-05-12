**Focus:** Produce the field-level mapping table for this unit's slice — every source field, every target field, every transformation rule. This is the contract the migrate stage implements verbatim; vagueness here becomes bugs in code. "TBD" is not a mapping rule.

You produce one artifact: the mapping tables for this unit's section of `MAPPING-SPEC.md`, plus the transformation-rule notes that the migrate stage will compile into scripts.

## Process

### 1. Read the inventory row for this entity / surface

Before writing any mapping, read the upstream inventory entry. It names the source artifact, its volume, its read consumers, its write producers. The mapping has to satisfy every downstream consumer's contract, not just the persistence layer.

### 2. Write the mapping table

Each source field gets one row. Target fields that have no source field (derived, defaulted, new) get rows too. The mapping table format:

| Source field | Source type | Target field | Target type | Transform rule | Null behavior | Notes |
|---|---|---|---|---|---|---|
| `<source.field>` | `<type>` | `<target.field>` | `<type>` | rename / cast / derive / default / drop | how nulls flow | encoding, precision, semantics |

Rules:

- **Every source field appears as a row.** A source field with no mapping is a "drop" decision; record it explicitly with the rationale.
- **Every target field appears as a row.** A target field with no source is a "derive" or "default" decision; the rule MUST name what produces the value.
- **Transform rules are typed.** Use the five categories: `rename`, `cast`, `derive`, `default`, `drop`. A combination (cast + rename) is two columns on the same row, not a free-text description.
- **Null behavior is explicit.** Source null → target null, source null → target default, source null → error, source null → drop row — pick one and write it.

### 3. Surface compatibility issues alongside the rows

For each row where the source and target differ in a way that risks data fidelity (type narrowing, precision loss, encoding change, constraint conflict, enum-value remap), add a `compatibility:` callout pointing at the row. The compatibility-reviewer hat consumes these.

### 4. Handle constraints explicitly

After the field rows, write a `## Constraint differences` section: unique constraints, foreign keys, check constraints, indexes. For each constraint that differs between source and target (added, removed, relaxed, tightened), record the difference and the chosen resolution (enforce in target, enforce in transform, accept divergence and document the residual risk).

### 5. Handle integration mappings if the unit covers them

If the unit's scope includes integrations (API contracts, event payloads, webhook formats), each integration gets its own table with the same shape — request fields, response fields, error codes, status semantics. Same rules apply: every field accounted for, every transform typed.

### 6. Self-check before handing off

- [ ] Every source field is a row (mapped, derived, or dropped — never silent)
- [ ] Every target field is a row (mapped from source, derived, or defaulted)
- [ ] Every transform rule uses one of the five typed categories
- [ ] Every row's null behavior is named explicitly
- [ ] Every constraint difference has a chosen resolution
- [ ] Cross-references to sibling units are explicit (an entity that joins to another unit's entity links to that unit)

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** map only the happy path and ignore nulls, encoding differences, or precision differences
- The agent **MUST NOT** leave fields as "TBD" instead of making an explicit decision (even if the decision is "drop with rationale R")
- The agent **MUST NOT** assume field names matching across systems have identical semantics; verify with the inventory's notes column
- The agent **MUST NOT** create mappings that can't be tested in isolation — every row must be independently exercisable
- The agent **MUST NOT** ignore constraints (unique, foreign key, check, not-null) that differ between source and target
- The agent **MUST NOT** describe transforms in prose when the typed-category column suffices — prose drifts when read by a downstream implementer
- The agent **MUST** record an explicit "drop" or "derive" decision for any source / target field without a 1:1 mapping
- The agent **MUST** cite the Decision register when a mapping rule contradicts a recorded decision (e.g., chosen encoding, retention rule)
