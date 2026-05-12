---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify that the scope stage's `CONTROL-MAPPING.md` identifies every applicable control across every named framework, inventories every relevant system with data classifications, and maps each control to the systems it binds. Scope gaps here are silent — they manifest as findings in the certify stage that the team cannot close without reopening the scope conversation.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Framework precision** — every named framework includes version and revision (e.g., "SOC 2 Type II, 2017 TSC" not "SOC 2"; "ISO/IEC 27001:2022" not "ISO 27001"). Frameworks evolve; assessing against the wrong revision produces evidence the auditor rejects.
- **Per-control applicability** — every control in each framework has an explicit `applicable / not applicable / inherited` decision with rationale. No control is silently omitted.
- **Inheritance evidence** — every control marked `inherited` names the inheritance source (e.g., AWS SOC 2 bridge letter, Stripe attestation). Unsourced inheritance is not evidence.
- **System inventory completeness** — every internally-built application, data store, third-party service, integration, and infrastructure surface that handles in-scope data is in the inventory. Third-party services are the most-frequently-missed category.
- **Data classification consistency** — every in-scope system has a data classification using a single declared scheme; the scheme is documented in the artifact.
- **Control-to-system mapping** — every applicable control names the bound systems. Many-systems-per-control is common; zero-systems-per-control is a finding.
- **In-scope / out-of-scope rationale** — every system has an explicit decision per framework with rationale. "Not relevant" is not a rationale.
- **Cross-framework overlap surfaced** — controls that appear in multiple frameworks (access control, data retention, incident response) are noted so downstream stages don't assess and evidence them twice.

## Common failure modes to look for

- A framework named without version (e.g., "SOC 2", "GDPR", "ISO 27001") — version is part of the scope contract
- A control silently omitted from the list with no applicability decision
- A `not applicable` decision with no rationale (or a rationale that doesn't actually rule out applicability)
- A `met` or `inherited` claim that names a third-party provider but no specific evidence (bridge letter, attestation, SOC report)
- A system inventory that omits an integration the rest of the document references (the auditor will follow that thread)
- Data classifications that vary in granularity across systems (`confidential` for one, `tier-2` for another) without a documented mapping
- Out-of-scope decisions that ignore data flows — a system that's "out of scope" but receives in-scope data is not out of scope
- A framework with overlapping controls where the overlaps aren't surfaced, leading to predictable duplication in assess and document stages
