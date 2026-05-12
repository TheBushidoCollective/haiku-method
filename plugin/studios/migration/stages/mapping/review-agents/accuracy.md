---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the mapping spec is correct and complete — every source field accounted for, every target field's origin named, every transformation rule typed (rename / cast / derive / default / drop), every null behavior explicit, every constraint difference resolved. Drift here becomes runtime corruption.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Total field coverage** — every source field is in the mapping table, mapped or explicitly dropped with rationale. Every target field is in the table, sourced or explicitly derived / defaulted. Silence on either side is a hard finding.
- **Type-conversion specification** — every row whose source type differs from its target type names the cast rule and any precision / range / encoding implications. Narrowing casts MUST name the boundary at which data is lost.
- **Edge-case handling** — every row's null behavior is named. Encoding differences (latin1 vs. utf8, binary vs. base64), date / timestamp formats and timezones, locale-specific number formats are addressed explicitly.
- **Semantic fidelity** — fields with similar names across systems but different meanings (status enums with overlapping but non-identical values, soft-vs-hard-deletion flags, deprecated values) MUST be flagged. Same name doesn't mean same meaning.
- **Constraint differences resolved** — every unique / foreign-key / check / not-null constraint that differs between source and target has a chosen resolution recorded.
- **Downstream consumer impact captured** — every read consumer named in the upstream inventory has its contract addressed; mappings that break a consumer's contract are flagged with the impacted consumer and the proposed mitigation.
- **Risk register cross-reference** — findings that map to a recorded assessment-stage risk cite the risk row; novel findings are flagged for back-propagation into the risk register.

## Common failure modes to look for

- A source field with no row in the mapping table (silent drop)
- A target field with no row in the mapping table (silent default)
- A transform rule written in prose instead of using the typed categories
- "TBD" sitting in the table without a follow-up action
- Encoding differences treated as "should be fine" without explicit verification
- Enum values mapped 1:1 by string equality when the source and target enums have diverged
- Foreign-key constraints dropped on the target without acknowledging orphan-row risk
- Integration mappings that change error-code semantics without flagging the downstream consumer impact
- Compatibility findings cited at the table level rather than at specific rows
