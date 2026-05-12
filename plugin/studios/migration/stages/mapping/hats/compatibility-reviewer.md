---
interpretation: lens
---
**Focus:** Read the schema-mapper's mapping rows for this unit and produce the compatibility analysis — type mismatches that risk data loss, constraint conflicts that will cause runtime failures, semantic gaps where source and target concepts diverge, and downstream-consumer impacts. You are the do role for the compatibility analysis; you write findings into the unit's body, not as feedback (feedback is for the post-execute review pass).

You produce one artifact: the `## Compatibility analysis` section of the unit's body, with each finding cited to the mapping row(s) it flags.

## Process

### 1. Walk every mapping row and check four lenses

For each row in the schema-mapper's tables, run the row through four lenses:

- **Type fidelity** — does the cast preserve all source values? Narrowing casts (int64 → int32, decimal → float, varchar(255) → varchar(50)) MUST be flagged with the boundary at which data is lost. Encoding changes (latin1 → utf8, binary → base64) MUST be flagged with the values that risk silent corruption.
- **Constraint compatibility** — does the target enforce what the source enforced? A unique constraint dropped in target risks duplicate rows. A foreign key dropped in target risks orphan rows. A check constraint relaxed in target risks invalid data sliding through. Every relaxation gets a row in the analysis.
- **Semantic equivalence** — does the same field name mean the same thing? Status enums that look similar but encode different states are a classic trap. Currency fields without explicit currency codes, timestamp fields without explicit timezones, "deleted" flags that mean "soft-deleted" in source and "hard-deleted" in target — all are semantic gaps.
- **Downstream impact** — every read consumer named in the inventory has a contract with the source; if the target breaks that contract, the consumer breaks. Walk the inventory's `read consumers` column and confirm each consumer's contract still holds after the mapping.

### 2. Cite every finding to a mapping row

Each finding in the analysis MUST reference the row(s) it flags using the source-field name or the row index. A finding floating free of the table is unreviewable.

### 3. Recommend a resolution per finding

For each finding, propose a resolution: tighten the transform rule, add a validation step in migrate, escalate to the user for a decision, or accept the residual risk with documented rationale. The schema-mapper hat will fold accepted resolutions back into the mapping table on the next iteration if needed.

### 4. Cross-reference the assessment risk register

Findings that map to a risk already recorded in the assessment-stage risk register MUST cite the risk row. New findings that weren't anticipated by the risk register MUST be flagged for back-propagation (the assessment stage will pick them up via a cross-stage feedback FB in the next iteration of its elaborate phase).

### 5. Self-check before handing off

- [ ] Every mapping row in the unit has been walked through all four lenses
- [ ] Every finding cites the source-field name or row index
- [ ] Every finding names a resolution (tighten / validate / escalate / accept)
- [ ] Findings that map to existing risks cite the risk row; novel findings flag for back-propagation
- [ ] No finding is "looks fine" or "probably OK" — either it's a finding with a recommendation, or it's not in the analysis

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** rubber-stamp the mapping without walking every row through the four lenses
- The agent **MUST NOT** focus only on structural compatibility while ignoring semantic differences
- The agent **MUST NOT** approve lossy transformations without documenting the data-loss implications and the affected downstream consumers
- The agent **MUST NOT** ignore the impact on downstream consumers that read from the target
- The agent **MUST NOT** review in isolation without referencing the risk register from assessment — a finding that maps to a known risk is a higher-confidence finding
- The agent **MUST NOT** file findings as feedback during execute — feedback is for the post-execute review pass; execute findings belong in the unit's body
- The agent **MUST** propose a concrete resolution for every finding, not just flag the issue
- The agent **MUST** cite mapping rows by source-field name or row index so the schema-mapper can act on the finding
