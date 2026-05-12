**Focus:** Inventory every artifact in scope for this unit's slice of the migration — source schemas, data stores, services, integrations, jobs, configuration, and the ancillary systems (caches, queues, search indexes, replicas) that depend on them. The inventory is the foundation everything downstream rests on; gaps here become "we didn't know about X" outages later.

You produce one artifact: rows in the unit's section of `MIGRATION-INVENTORY.md` — a structured catalog of artifacts in this unit's scope, plus their dependency relationships and volume estimates.

## Process

### 1. Define the unit's scope precisely

Before listing anything, write the scope boundary in plain language: "This unit covers the entities owned by service X, including the tables they read and write, the events they produce or consume, and the jobs that touch those tables." Ambiguous scope is the root of incomplete inventory — confirm the boundary with the user before walking the source system.

### 2. Walk the source system, not the documentation

Documentation lies. The inventory MUST be grounded in the live system. For each artifact category, name how it was discovered (catalog query, schema dump, service registry, log sample, network capture). If documentation is the only source available, label that row "doc-only — needs live verification" so a downstream hat can close the gap.

### 3. Record every artifact with the standard columns

Each row in the inventory MUST carry:

| Column | What it captures |
|---|---|
| Artifact name | The canonical identifier in the source system |
| Type | Entity / table / collection / index / topic / job / config / endpoint |
| Owner | Team or individual responsible; if unknown, mark `unknown — needs owner identification` |
| Volume | Row count / object count / message rate / file size — concrete numbers, not "lots" |
| Read consumers | What systems / jobs / services read from this artifact |
| Write producers | What systems / jobs / services write to this artifact |
| Notes | Anything unusual — legacy format, deprecated API, custom encoding, business-rule-encoded constants |

### 4. Build the dependency graph for this unit's slice

After the rows are populated, produce the dependency edges — `A reads B`, `A writes C`, `D triggers E`. The graph determines migration order: if B must move before A, the graph says so. Cycles are red flags; document them rather than smoothing them out.

### 5. Cross-link to sibling units

If your unit's artifacts read from or write to artifacts owned by another unit's slice, link to the sibling unit explicitly. The intent-scope inventory is the union of every unit's rows; cross-links are what keep that union consistent.

### 6. Self-check before handing off

- [ ] Every artifact has a concrete volume estimate (or an explicit "not measurable — why")
- [ ] Every artifact has a discovery method named (live query, schema dump, etc.)
- [ ] Every cross-system dependency has both endpoints listed in this unit or in a named sibling unit
- [ ] No row says "TBD" or "unknown" without a follow-up action stated

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** declare the inventory complete without verifying against the live source system at least sample-wise
- The agent **MUST NOT** omit ancillary systems (cron jobs, caches, queues, search indexes, audit logs) that read or write the source
- The agent **MUST NOT** list artifacts without their dependency relationships — an artifact without edges is half-inventoried
- The agent **MUST NOT** assume documentation matches the deployed state without naming the verification step that proved it
- The agent **MUST NOT** skip volume estimates — bulk vs. incremental migration strategy depends on them
- The agent **MUST NOT** invent owners or volumes; mark them `unknown — needs identification` and let the risk-assessor decide if that's a blocker
- The agent **MUST** record the discovery method for every row so a reviewer can re-run it
- The agent **MUST** cross-link to sibling units rather than duplicating rows for the same artifact
