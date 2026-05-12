---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that the evidence package presents complete, current, well-provenanced, navigable evidence for every in-scope control, with continuous coverage across the audit period. Weak evidence is how audits stretch into clarification cycles and how findings appear for controls that were actually operating.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Per-control evidence presence** — every in-scope control from `CONTROL-MAPPING.md` has at least one evidence item OR an explicit acknowledged gap with routing to upstream stages. No control is silently un-evidenced.
- **Provenance completeness** — every evidence item has source, capture date, capturing role / person, and the path / location of the artifact. Missing provenance is not evidence.
- **Timestamps present and meaningful** — every screenshot, export, log excerpt, and signed attestation includes a timestamp; the timestamp is from within the audit-period coverage window or is otherwise justified.
- **Audit-period coverage continuity** — for Type II / period-based engagements, evidence spans the full audit period with no unexplained gaps. Discontinuous coverage is itself a finding.
- **Format matches framework expectations** — the package structure (control-family ordering, document-naming conventions, supporting-artifact tree) matches the conventions the auditor expects for the framework.
- **Cross-references resolve** — every "see Evidence E-NN" reference in the narrative resolves to an existing evidence-inventory row.
- **Narrative claims trace to evidence** — every claim in the control narratives cites a specific evidence row, not "as discussed above" or "per the team".
- **Shared evidence credited once** — evidence supporting multiple controls is described once in the inventory and referenced from each control narrative, not duplicated and drifted.

## Common failure modes to look for

- A screenshot without a timestamp or surrounding URL / context that locates it in the system being evidenced
- An evidence inventory entry citing "the team" or "the lead" as source rather than a role + named individual + date
- A control narrative that asserts "monitoring is in place" with no monitoring screenshot, log sample, or alert-history reference
- An audit-period gap (e.g., evidence dated October and February with nothing for November–January) silently passed off as "continuous"
- Verbal attestation treated as primary evidence with no follow-up artifact (signed memo, ticket, dated email confirmation)
- Two different evidence items for the same artifact (an IAM policy listed once for CC6.1 and again for A.9 with no cross-reference) — drift waiting to happen
- A management summary that overstates coverage (says "all controls met" when the inventory clearly shows partials and acknowledged gaps)
- Evidence package organized by submission order rather than by control family, forcing the auditor to reverse-engineer the structure
- Third-party / inherited evidence (bridge letters, sub-processor attestations) included without confirming the inheriting control is actually inherited at the scope-stage level
